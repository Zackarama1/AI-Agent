"""StockSense API — the backend for the mobile app.

Run:  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
Docs: http://localhost:8000/docs

Market data comes from a live provider (Yahoo Finance by default — no key
needed) with a mock fallback. Portfolios are paper-trading accounts: virtual
cash, market orders at live prices, positions derived from fills.

Market-data routes (quote/news/history/search) are public. Everything tied to
a person — account, orders, watchlist, alerts — requires a Bearer token.
"""

import asyncio
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import ai, alerts, auth, market, portfolio, trading, watchlist
from .config import settings
from .models import (
    AccountSummary,
    Alert,
    AlertIn,
    AuthResponse,
    Brief,
    EarningsEvent,
    Fill,
    History,
    NewsItem,
    OrderIn,
    PushToken,
    Quote,
    SearchResult,
    Trade,
    UserIn,
    UserOut,
    WatchIn,
    WatchItem,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    portfolio.init_db()
    auth.init_db()
    trading.init_db()
    watchlist.init_db()
    alerts.init_db()
    task = asyncio.create_task(alerts.alert_loop())
    yield
    task.cancel()


app = FastAPI(title="StockSense API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

CurrentUser = Depends(auth.get_current_user)


@app.get("/api/health")
async def health() -> dict:
    return {
        "status": "ok",
        "market_provider": settings.provider,
        "live_quotes": settings.provider != "mock",
        "ai_briefs": settings.has_anthropic,
    }


# ---- Auth (public) --------------------------------------------------------

@app.post("/api/auth/register", response_model=AuthResponse, status_code=201)
async def register(body: UserIn) -> AuthResponse:
    user = auth.create_user(body.email, body.password)
    return AuthResponse(token=auth.issue_token(user), user=user)


@app.post("/api/auth/login", response_model=AuthResponse)
async def login(body: UserIn) -> AuthResponse:
    user = auth.authenticate(body.email, body.password)
    return AuthResponse(token=auth.issue_token(user), user=user)


@app.get("/api/auth/me", response_model=UserOut)
async def me(user: UserOut = CurrentUser) -> UserOut:
    return user


# ---- Market data (public) -------------------------------------------------

@app.get("/api/quote/{symbol}", response_model=Quote)
async def quote(symbol: str) -> Quote:
    return await market.get_quote(symbol)


@app.get("/api/news/{symbol}", response_model=list[NewsItem])
async def news(symbol: str) -> list[NewsItem]:
    return await market.get_company_news(symbol)


@app.get("/api/history/{symbol}", response_model=History)
async def history(symbol: str, days: int = 30) -> History:
    return await market.get_history(symbol, days=days)


@app.get("/api/search", response_model=list[SearchResult])
async def search(q: str) -> list[SearchResult]:
    return await market.search_symbols(q)


# ---- Paper-trading account (auth) -----------------------------------------

@app.get("/api/account", response_model=AccountSummary)
async def account(user: UserOut = CurrentUser) -> AccountSummary:
    return await trading.get_account_summary(user.id)


# Back-compat alias — the app's portfolio view is the account.
@app.get("/api/portfolio", response_model=AccountSummary)
async def get_portfolio(user: UserOut = CurrentUser) -> AccountSummary:
    return await trading.get_account_summary(user.id)


@app.post("/api/orders", response_model=Fill, status_code=201)
async def place_order(order: OrderIn, user: UserOut = CurrentUser) -> Fill:
    return await trading.place_order(user.id, order)


@app.get("/api/orders", response_model=list[Trade])
async def list_orders(user: UserOut = CurrentUser) -> list[Trade]:
    return trading.list_trades(user.id)


@app.post("/api/account/reset", response_model=AccountSummary)
async def reset_account(user: UserOut = CurrentUser) -> AccountSummary:
    trading.reset_account(user.id)
    return await trading.get_account_summary(user.id)


@app.get("/api/portfolio/brief", response_model=Brief)
async def portfolio_brief(user: UserOut = CurrentUser) -> Brief:
    summary = await trading.get_account_summary(user.id)
    return await ai.generate_brief(summary)


# ---- Earnings calendar (auth) ---------------------------------------------

@app.get("/api/calendar/earnings", response_model=list[EarningsEvent])
async def earnings_calendar(user: UserOut = CurrentUser) -> list[EarningsEvent]:
    symbols = set(trading.position_symbols(user.id))
    symbols |= {w.symbol for w in await watchlist.get_all(user.id)}
    events: list[EarningsEvent] = []
    for sym in symbols:
        events.extend(await market.get_earnings(sym))
    events.sort(key=lambda e: e.date)
    return events


# ---- Watchlist (auth) -----------------------------------------------------

@app.get("/api/watchlist", response_model=list[WatchItem])
async def get_watchlist(user: UserOut = CurrentUser) -> list[WatchItem]:
    return await watchlist.get_all(user.id)


@app.post("/api/watchlist", status_code=201)
async def add_watch(item: WatchIn, user: UserOut = CurrentUser) -> dict:
    watchlist.add(user.id, item)
    return {"ok": True}


@app.delete("/api/watchlist/{symbol}", status_code=204)
async def remove_watch(symbol: str, user: UserOut = CurrentUser) -> None:
    if not watchlist.remove(user.id, symbol):
        raise HTTPException(status_code=404, detail="Symbol not on watchlist")


# ---- Alerts + push (auth) -------------------------------------------------

@app.get("/api/alerts", response_model=list[Alert])
async def get_alerts(user: UserOut = CurrentUser) -> list[Alert]:
    return alerts.list_alerts(user.id)


@app.post("/api/alerts", response_model=Alert, status_code=201)
async def create_alert(a: AlertIn, user: UserOut = CurrentUser) -> Alert:
    return alerts.add_alert(user.id, a)


@app.delete("/api/alerts/{alert_id}", status_code=204)
async def remove_alert(alert_id: int, user: UserOut = CurrentUser) -> None:
    if not alerts.delete_alert(user.id, alert_id):
        raise HTTPException(status_code=404, detail="Alert not found")


@app.post("/api/alerts/check", response_model=list[Alert])
async def check_alerts_now(user: UserOut = CurrentUser) -> list[Alert]:
    return await alerts.check_alerts(user.id)


@app.post("/api/push/register", status_code=201)
async def register_push(t: PushToken, user: UserOut = CurrentUser) -> dict:
    alerts.register_token(user.id, t.token)
    return {"ok": True}
