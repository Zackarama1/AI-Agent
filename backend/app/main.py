"""StockSense API — the backend for the mobile app.

Run:  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
Docs: http://localhost:8000/docs

Market-data routes (quote/news/history/search) are public. Everything tied to
a person — holdings, portfolio, watchlist, alerts, push — requires a Bearer
token from /api/auth/login and is scoped to that user.
"""

import asyncio
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import ai, alerts, auth, market, portfolio, watchlist
from .config import settings
from .models import (
    Alert,
    AlertIn,
    AuthResponse,
    Brief,
    EarningsEvent,
    History,
    Holding,
    HoldingIn,
    NewsItem,
    PortfolioSummary,
    PushToken,
    Quote,
    SearchResult,
    UserIn,
    UserOut,
    WatchIn,
    WatchItem,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    portfolio.init_db()
    auth.init_db()
    watchlist.init_db()
    alerts.init_db()
    task = asyncio.create_task(alerts.alert_loop())
    yield
    task.cancel()


app = FastAPI(title="StockSense API", version="0.1.0", lifespan=lifespan)

# Open CORS for local dev (Expo runs on a different origin/host).
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
        "live_quotes": settings.has_finnhub,
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


# ---- Earnings calendar (auth: scoped to the user's symbols) ----------------

@app.get("/api/calendar/earnings", response_model=list[EarningsEvent])
async def earnings_calendar(user: UserOut = CurrentUser) -> list[EarningsEvent]:
    symbols = {h.symbol for h in portfolio.list_holdings(user.id)}
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
    """Manually evaluate the caller's alerts now (the loop also does this)."""
    return await alerts.check_alerts(user.id)


@app.post("/api/push/register", status_code=201)
async def register_push(t: PushToken, user: UserOut = CurrentUser) -> dict:
    alerts.register_token(user.id, t.token)
    return {"ok": True}


# ---- Portfolio / holdings (auth) ------------------------------------------

@app.get("/api/holdings", response_model=list[Holding])
async def get_holdings(user: UserOut = CurrentUser) -> list[Holding]:
    return portfolio.list_holdings(user.id)


@app.post("/api/holdings", response_model=Holding, status_code=201)
async def create_holding(h: HoldingIn, user: UserOut = CurrentUser) -> Holding:
    return portfolio.add_holding(user.id, h)


@app.delete("/api/holdings/{holding_id}", status_code=204)
async def remove_holding(holding_id: int, user: UserOut = CurrentUser) -> None:
    if not portfolio.delete_holding(user.id, holding_id):
        raise HTTPException(status_code=404, detail="Holding not found")


@app.get("/api/portfolio", response_model=PortfolioSummary)
async def get_portfolio(user: UserOut = CurrentUser) -> PortfolioSummary:
    return await portfolio.get_summary(user.id)


@app.get("/api/portfolio/brief", response_model=Brief)
async def portfolio_brief(user: UserOut = CurrentUser) -> Brief:
    summary = await portfolio.get_summary(user.id)
    return await ai.generate_brief(summary)
