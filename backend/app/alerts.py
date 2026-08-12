"""Price alerts + Expo push delivery.

An alert is a one-shot rule: "notify me when AAPL goes above/below $X". A
background task (started in main.py's lifespan) polls quotes and pushes a
notification to every registered device when a rule triggers, then deactivates
that rule.

Push uses Expo's push service (https://exp.host) so it works without Apple/
Firebase credentials during development. No registered tokens => no-op.
"""

import asyncio

import httpx

from .config import settings
from .market import get_quote
from .models import AlertIn, Alert
from .portfolio import _conn

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
CHECK_INTERVAL_SECONDS = 60


def init_db() -> None:
    with _conn() as c:
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS alerts (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol    TEXT NOT NULL,
                direction TEXT NOT NULL CHECK (direction IN ('above', 'below')),
                target    REAL NOT NULL,
                active    INTEGER NOT NULL DEFAULT 1
            )
            """
        )
        c.execute(
            "CREATE TABLE IF NOT EXISTS push_tokens (token TEXT PRIMARY KEY)"
        )


def add_alert(a: AlertIn) -> Alert:
    with _conn() as c:
        cur = c.execute(
            "INSERT INTO alerts (symbol, direction, target) VALUES (?, ?, ?)",
            (a.symbol.upper(), a.direction, a.target),
        )
        return Alert(id=cur.lastrowid, active=True, **a.model_dump())


def list_alerts() -> list[Alert]:
    with _conn() as c:
        rows = c.execute("SELECT * FROM alerts ORDER BY active DESC, symbol").fetchall()
    return [
        Alert(id=r["id"], symbol=r["symbol"], direction=r["direction"],
              target=r["target"], active=bool(r["active"]))
        for r in rows
    ]


def delete_alert(alert_id: int) -> bool:
    with _conn() as c:
        cur = c.execute("DELETE FROM alerts WHERE id = ?", (alert_id,))
        return cur.rowcount > 0


def register_token(token: str) -> None:
    with _conn() as c:
        c.execute("INSERT OR IGNORE INTO push_tokens (token) VALUES (?)", (token,))


def _tokens() -> list[str]:
    with _conn() as c:
        return [r["token"] for r in c.execute("SELECT token FROM push_tokens").fetchall()]


def _active_alerts() -> list[Alert]:
    return [a for a in list_alerts() if a.active]


def _deactivate(alert_id: int) -> None:
    with _conn() as c:
        c.execute("UPDATE alerts SET active = 0 WHERE id = ?", (alert_id,))


async def send_push(title: str, body: str, data: dict | None = None) -> None:
    tokens = _tokens()
    if not tokens:
        return
    messages = [
        {"to": t, "title": title, "body": body, "sound": "default", "data": data or {}}
        for t in tokens
    ]
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(EXPO_PUSH_URL, json=messages)
    except httpx.HTTPError:
        pass  # best-effort; a failed push shouldn't crash the checker


async def check_alerts() -> list[Alert]:
    """Evaluate active alerts once; push + deactivate any that trigger.

    Returns the alerts that fired (handy for a manual /api/alerts/check call)."""
    active = _active_alerts()
    if not active:
        return []

    fired: list[Alert] = []
    # Cache quotes per symbol so N alerts on one ticker = one lookup.
    seen: dict[str, float] = {}
    for a in active:
        if a.symbol not in seen:
            seen[a.symbol] = (await get_quote(a.symbol)).price
        price = seen[a.symbol]
        hit = (a.direction == "above" and price >= a.target) or (
            a.direction == "below" and price <= a.target
        )
        if hit:
            await send_push(
                title=f"{a.symbol} {a.direction} ${a.target:g}",
                body=f"{a.symbol} is at ${price:,.2f}.",
                data={"symbol": a.symbol},
            )
            _deactivate(a.id)
            fired.append(a)
    return fired


async def alert_loop() -> None:
    """Background poller. Started as a task in the app lifespan."""
    while True:
        try:
            await check_alerts()
        except Exception:
            pass  # never let the loop die on a transient error
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
