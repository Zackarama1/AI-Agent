"""Portfolio persistence (SQLite) + live P/L computation.

Storage is intentionally simple: one holdings table, no auth yet. Multi-user
auth is a Phase-4 concern — for now the whole app is a single portfolio.
"""

import sqlite3
from contextlib import contextmanager

from .config import settings
from .market import get_quotes
from .models import Holding, HoldingIn, HoldingWithQuote, PortfolioSummary


@contextmanager
def _conn():
    conn = sqlite3.connect(settings.db_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with _conn() as c:
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS holdings (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol     TEXT NOT NULL,
                shares     REAL NOT NULL,
                cost_basis REAL NOT NULL
            )
            """
        )


def add_holding(h: HoldingIn) -> Holding:
    with _conn() as c:
        cur = c.execute(
            "INSERT INTO holdings (symbol, shares, cost_basis) VALUES (?, ?, ?)",
            (h.symbol.upper(), h.shares, h.cost_basis),
        )
        return Holding(id=cur.lastrowid, **h.model_dump())


def list_holdings() -> list[Holding]:
    with _conn() as c:
        rows = c.execute("SELECT * FROM holdings ORDER BY symbol").fetchall()
    return [Holding(**dict(r)) for r in rows]


def delete_holding(holding_id: int) -> bool:
    with _conn() as c:
        cur = c.execute("DELETE FROM holdings WHERE id = ?", (holding_id,))
        return cur.rowcount > 0


async def get_summary() -> PortfolioSummary:
    holdings = list_holdings()
    if not holdings:
        return PortfolioSummary(
            holdings=[], total_value=0, total_cost=0, total_gain=0,
            total_gain_percent=0, day_change=0, day_change_percent=0,
        )

    quotes = await get_quotes([h.symbol for h in holdings])

    enriched: list[HoldingWithQuote] = []
    total_value = total_cost = day_change = 0.0
    for h in holdings:
        q = quotes[h.symbol.upper()]
        market_value = q.price * h.shares
        total = h.cost_basis * h.shares
        gain = market_value - total
        prev_value = q.prev_close * h.shares
        enriched.append(
            HoldingWithQuote(
                **h.model_dump(),
                price=q.price,
                market_value=round(market_value, 2),
                total_cost=round(total, 2),
                gain=round(gain, 2),
                gain_percent=round((gain / total) * 100, 2) if total else 0.0,
                day_change=round(market_value - prev_value, 2),
                day_change_percent=q.percent_change,
            )
        )
        total_value += market_value
        total_cost += total
        day_change += market_value - prev_value

    total_gain = total_value - total_cost
    prev_total = total_value - day_change
    return PortfolioSummary(
        holdings=enriched,
        total_value=round(total_value, 2),
        total_cost=round(total_cost, 2),
        total_gain=round(total_gain, 2),
        total_gain_percent=round((total_gain / total_cost) * 100, 2) if total_cost else 0.0,
        day_change=round(day_change, 2),
        day_change_percent=round((day_change / prev_total) * 100, 2) if prev_total else 0.0,
    )
