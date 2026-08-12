"""Price alerts + Expo push delivery, scoped per user.

An alert is a one-shot rule: "notify me when AAPL goes above/below $X". A
background task (started in main.py's lifespan) polls quotes and pushes a
notification to the owning user's devices when a rule triggers, then
deactivates that rule.

Push uses Expo's push service (https://exp.host) so it works without Apple/
Firebase credentials during development. No registered tokens => no-op.
"""

import asyncio

import httpx

from .market import get_quote
from .models import AlertIn, Alert
from .portfolio import _conn, ensure_column

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
CHECK_INTERVAL_SECONDS = 60


def init_db() -> None:
    with _conn() as c:
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS alerts (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id   INTEGER NOT NULL DEFAULT 0,
                symbol    TEXT NOT NULL,
                direction TEXT NOT NULL CHECK (direction IN ('above', 'below')),
                target    REAL NOT NULL,
                active    INTEGER NOT NULL DEFAULT 1
            )
            """
        )
        ensure_column(c, "alerts", "user_id", "INTEGER NOT NULL DEFAULT 0")
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS push_tokens (
                token   TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        ensure_column(c, "push_tokens", "user_id", "INTEGER NOT NULL DEFAULT 0")


def add_alert(user_id: int, a: AlertIn) -> Alert:
    with _conn() as c:
        cur = c.execute(
            "INSERT INTO alerts (user_id, symbol, direction, target) VALUES (?, ?, ?, ?)",
            (user_id, a.symbol.upper(), a.direction, a.target),
        )
        return Alert(id=cur.lastrowid, active=True, **a.model_dump())


def list_alerts(user_id: int) -> list[Alert]:
    with _conn() as c:
        rows = c.execute(
            "SELECT id, symbol, direction, target, active FROM alerts "
            "WHERE user_id = ? ORDER BY active DESC, symbol",
            (user_id,),
        ).fetchall()
    return [
        Alert(id=r["id"], symbol=r["symbol"], direction=r["direction"],
              target=r["target"], active=bool(r["active"]))
        for r in rows
    ]


def delete_alert(user_id: int, alert_id: int) -> bool:
    with _conn() as c:
        cur = c.execute(
            "DELETE FROM alerts WHERE id = ? AND user_id = ?", (alert_id, user_id)
        )
        return cur.rowcount > 0


def register_token(user_id: int, token: str) -> None:
    with _conn() as c:
        # A device belongs to whoever last logged in on it.
        c.execute(
            "INSERT INTO push_tokens (token, user_id) VALUES (?, ?) "
            "ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id",
            (token, user_id),
        )


def _tokens_for(user_id: int) -> list[str]:
    with _conn() as c:
        return [
            r["token"]
            for r in c.execute(
                "SELECT token FROM push_tokens WHERE user_id = ?", (user_id,)
            ).fetchall()
        ]


def _deactivate(alert_id: int) -> None:
    with _conn() as c:
        c.execute("UPDATE alerts SET active = 0 WHERE id = ?", (alert_id,))


async def send_push(user_id: int, title: str, body: str, data: dict | None = None) -> None:
    tokens = _tokens_for(user_id)
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


def _active_rows(user_id: int | None) -> list[dict]:
    q = "SELECT id, user_id, symbol, direction, target FROM alerts WHERE active = 1"
    params: tuple = ()
    if user_id is not None:
        q += " AND user_id = ?"
        params = (user_id,)
    with _conn() as c:
        return [dict(r) for r in c.execute(q, params).fetchall()]


async def check_alerts(user_id: int | None = None) -> list[Alert]:
    """Evaluate active alerts once; push + deactivate any that trigger.

    With user_id=None (the background loop) it checks every user's alerts and
    pushes to each alert's owner. Returns the alerts that fired."""
    rows = _active_rows(user_id)
    if not rows:
        return []

    fired: list[Alert] = []
    seen: dict[str, float] = {}  # cache quote per symbol within a pass
    for r in rows:
        sym = r["symbol"]
        if sym not in seen:
            seen[sym] = (await get_quote(sym)).price
        price = seen[sym]
        hit = (r["direction"] == "above" and price >= r["target"]) or (
            r["direction"] == "below" and price <= r["target"]
        )
        if hit:
            await send_push(
                r["user_id"],
                title=f"{sym} {r['direction']} ${r['target']:g}",
                body=f"{sym} is at ${price:,.2f}.",
                data={"symbol": sym},
            )
            _deactivate(r["id"])
            fired.append(
                Alert(id=r["id"], symbol=sym, direction=r["direction"],
                      target=r["target"], active=False)
            )
    return fired


async def alert_loop() -> None:
    """Background poller. Started as a task in the app lifespan."""
    while True:
        try:
            await check_alerts()  # all users
        except Exception:
            pass  # never let the loop die on a transient error
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
