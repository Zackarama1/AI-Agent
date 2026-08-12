"""Watchlist: symbols the user is tracking but doesn't (necessarily) own.

Separate from holdings on purpose — a watchlist is Apple-Stocks-style
follow-along, while holdings drive P/L. Same single-portfolio, no-auth caveat
as portfolio.py applies until Phase 4.
"""

from .market import get_quotes
from .models import WatchIn, WatchItem
from .portfolio import _conn


def init_db() -> None:
    with _conn() as c:
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS watchlist (
                id     INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL UNIQUE
            )
            """
        )


def add(item: WatchIn) -> None:
    with _conn() as c:
        c.execute(
            "INSERT OR IGNORE INTO watchlist (symbol) VALUES (?)",
            (item.symbol.upper(),),
        )


def remove(symbol: str) -> bool:
    with _conn() as c:
        cur = c.execute("DELETE FROM watchlist WHERE symbol = ?", (symbol.upper(),))
        return cur.rowcount > 0


def _symbols() -> list[tuple[int, str]]:
    with _conn() as c:
        rows = c.execute("SELECT id, symbol FROM watchlist ORDER BY symbol").fetchall()
    return [(r["id"], r["symbol"]) for r in rows]


async def get_all() -> list[WatchItem]:
    rows = _symbols()
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
