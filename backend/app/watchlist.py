"""Watchlist: symbols the user is tracking but doesn't (necessarily) own.

Separate from holdings on purpose — a watchlist is Apple-Stocks-style
follow-along, while holdings drive P/L. Scoped per user.
"""

from .market import get_quotes
from .models import WatchIn, WatchItem
from .portfolio import _conn, ensure_column


def init_db() -> None:
    with _conn() as c:
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS watchlist (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL DEFAULT 0,
                symbol  TEXT NOT NULL
            )
            """
        )
        ensure_column(c, "watchlist", "user_id", "INTEGER NOT NULL DEFAULT 0")
        # One row per (user, symbol).
        c.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_watch_user_symbol "
            "ON watchlist (user_id, symbol)"
        )


def add(user_id: int, item: WatchIn) -> None:
    with _conn() as c:
        c.execute(
            "INSERT OR IGNORE INTO watchlist (user_id, symbol) VALUES (?, ?)",
            (user_id, item.symbol.upper()),
        )


def remove(user_id: int, symbol: str) -> bool:
    with _conn() as c:
        cur = c.execute(
            "DELETE FROM watchlist WHERE user_id = ? AND symbol = ?",
            (user_id, symbol.upper()),
        )
        return cur.rowcount > 0


def _symbols(user_id: int) -> list[tuple[int, str]]:
    with _conn() as c:
        rows = c.execute(
            "SELECT id, symbol FROM watchlist WHERE user_id = ? ORDER BY symbol",
            (user_id,),
        ).fetchall()
    return [(r["id"], r["symbol"]) for r in rows]


async def get_all(user_id: int) -> list[WatchItem]:
    rows = _symbols(user_id)
    if not rows:
        return []
    quotes = await get_quotes([sym for _, sym in rows])
    return [
        WatchItem(
            id=wid,
            symbol=sym,
            price=quotes[sym].price,
            change=quotes[sym].change,
            percent_change=quotes[sym].percent_change,
        )
        for wid, sym in rows
    ]
