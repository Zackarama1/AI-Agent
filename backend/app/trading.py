"""Paper-trading engine: a cash account, market orders, and positions.

Every user gets a virtual cash account (settings.starting_cash). Orders execute
immediately at the current live price (market orders). Positions are *derived*
by replaying the user's fills with average-cost accounting — there's no
separately-stored holdings table to drift out of sync.
"""

import time

from fastapi import HTTPException

from .config import settings
from .market import get_quote, get_quotes
from .models import AccountSummary, Fill, OrderIn, Position, Trade
from .portfolio import _conn, ensure_column

EPS = 1e-9


def init_db() -> None:
    with _conn() as c:
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS accounts (
                user_id INTEGER PRIMARY KEY,
                cash    REAL NOT NULL
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS trades (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id  INTEGER NOT NULL,
                symbol   TEXT NOT NULL,
                side     TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
                quantity REAL NOT NULL,
                price    REAL NOT NULL,
                ts       INTEGER NOT NULL
            )
            """
        )
        ensure_column(c, "trades", "user_id", "INTEGER NOT NULL DEFAULT 0")


def _get_cash(user_id: int) -> float:
    """Cash balance, creating the account with starting cash on first touch."""
    with _conn() as c:
        row = c.execute("SELECT cash FROM accounts WHERE user_id = ?", (user_id,)).fetchone()
        if row is None:
            c.execute(
                "INSERT INTO accounts (user_id, cash) VALUES (?, ?)",
                (user_id, settings.starting_cash),
            )
            return settings.starting_cash
        return row["cash"]


def _set_cash(user_id: int, cash: float) -> None:
    with _conn() as c:
        c.execute("UPDATE accounts SET cash = ? WHERE user_id = ?", (round(cash, 2), user_id))


def list_trades(user_id: int) -> list[Trade]:
    with _conn() as c:
        rows = c.execute(
            "SELECT id, symbol, side, quantity, price, ts FROM trades "
            "WHERE user_id = ? ORDER BY ts DESC, id DESC",
            (user_id,),
        ).fetchall()
    return [Trade(**dict(r)) for r in rows]


def _net_position(user_id: int, symbol: str) -> float:
    with _conn() as c:
        rows = c.execute(
            "SELECT side, quantity FROM trades WHERE user_id = ? AND symbol = ?",
            (user_id, symbol.upper()),
        ).fetchall()
    return sum((r["quantity"] if r["side"] == "buy" else -r["quantity"]) for r in rows)


async def place_order(user_id: int, order: OrderIn) -> Fill:
    symbol = order.symbol.upper()
    quote = await get_quote(symbol)
    price = quote.price
    cash = _get_cash(user_id)

    if order.side == "buy":
        cost = order.quantity * price
        if cost > cash + EPS:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient buying power: need ${cost:,.2f}, have ${cash:,.2f}",
            )
        cash -= cost
    else:  # sell
        held = _net_position(user_id, symbol)
        if order.quantity > held + EPS:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough shares: trying to sell {order.quantity:g}, hold {held:g}",
            )
        cash += order.quantity * price

    ts = int(time.time())
    with _conn() as c:
        cur = c.execute(
            "INSERT INTO trades (user_id, symbol, side, quantity, price, ts) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, symbol, order.side, order.quantity, price, ts),
        )
        trade_id = cur.lastrowid
    _set_cash(user_id, cash)

    return Fill(
        trade=Trade(id=trade_id, symbol=symbol, side=order.side,
                    quantity=order.quantity, price=price, ts=ts),
        cash_after=round(cash, 2),
    )


def _positions_raw(user_id: int) -> dict[str, tuple[float, float]]:
    """Replay fills → {symbol: (net_shares, avg_cost)} with average-cost basis."""
    with _conn() as c:
        rows = c.execute(
            "SELECT symbol, side, quantity, price FROM trades "
            "WHERE user_id = ? ORDER BY ts ASC, id ASC",
            (user_id,),
        ).fetchall()

    shares: dict[str, float] = {}
    cost: dict[str, float] = {}  # total cost of current open shares
    for r in rows:
        sym, side, qty, price = r["symbol"], r["side"], r["quantity"], r["price"]
        sh = shares.get(sym, 0.0)
        ct = cost.get(sym, 0.0)
        if side == "buy":
            shares[sym] = sh + qty
            cost[sym] = ct + qty * price
        else:
            avg = (ct / sh) if sh > EPS else 0.0
            shares[sym] = sh - qty
            cost[sym] = max(0.0, ct - avg * qty)

    out: dict[str, tuple[float, float]] = {}
    for sym, sh in shares.items():
        if sh > EPS:
            avg = cost.get(sym, 0.0) / sh
            out[sym] = (sh, avg)
    return out


async def get_account_summary(user_id: int) -> AccountSummary:
    cash = _get_cash(user_id)
    raw = _positions_raw(user_id)

    positions: list[Position] = []
    market_value = invested = day_change = 0.0
    if raw:
        quotes = await get_quotes(list(raw.keys()))
        for sym, (qty, avg) in sorted(raw.items()):
            q = quotes[sym]
            mv = q.price * qty
            cb = avg * qty
            prev_mv = q.prev_close * qty
            positions.append(Position(
                symbol=sym, quantity=round(qty, 6), avg_cost=round(avg, 2),
                price=q.price, market_value=round(mv, 2), cost_basis=round(cb, 2),
                unrealized_pl=round(mv - cb, 2),
                unrealized_pl_percent=round((mv - cb) / cb * 100, 2) if cb else 0.0,
                day_change=round(mv - prev_mv, 2),
                day_change_percent=q.percent_change,
            ))
            market_value += mv
            invested += cb
            day_change += mv - prev_mv

    total_value = cash + market_value
    total_pl = market_value - invested
    prev_total = total_value - day_change
    return AccountSummary(
        cash=round(cash, 2),
        buying_power=round(cash, 2),
        positions=positions,
        invested=round(invested, 2),
        market_value=round(market_value, 2),
        total_value=round(total_value, 2),
        total_pl=round(total_pl, 2),
        total_pl_percent=round(total_pl / invested * 100, 2) if invested else 0.0,
        day_change=round(day_change, 2),
        day_change_percent=round(day_change / prev_total * 100, 2) if prev_total else 0.0,
        starting_cash=settings.starting_cash,
    )


def position_symbols(user_id: int) -> list[str]:
    return list(_positions_raw(user_id).keys())


def reset_account(user_id: int) -> None:
    with _conn() as c:
        c.execute("DELETE FROM trades WHERE user_id = ?", (user_id,))
        c.execute(
            "INSERT INTO accounts (user_id, cash) VALUES (?, ?) "
            "ON CONFLICT(user_id) DO UPDATE SET cash = excluded.cash",
            (user_id, settings.starting_cash),
        )
