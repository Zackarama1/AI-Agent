"""StockSense API — the backend for the mobile app.

Run:  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
Docs: http://localhost:8000/docs
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import ai, market, portfolio, watchlist
from .config import settings
from .models import (
    Brief,
    History,
    Holding,
    HoldingIn,
    NewsItem,
    PortfolioSummary,
    Quote,
    SearchResult,
    WatchIn,
    WatchItem,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    portfolio.init_db()
    watchlist.init_db()
    yield


app = FastAPI(title="StockSense API", version="0.1.0", lifespan=lifespan)

# Open CORS for local dev (Expo runs on a different origin/host).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict:
    return {
        "status": "ok",
        "live_quotes": settings.has_finnhub,
        "ai_briefs": settings.has_anthropic,
    }


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


@app.get("/api/watchlist", response_model=list[WatchItem])
async def get_watchlist() -> list[WatchItem]:
    return await watchlist.get_all()


@app.post("/api/watchlist", status_code=201)
async def add_watch(item: WatchIn) -> dict:
    watchlist.add(item)
    return {"ok": True}


@app.delete("/api/watchlist/{symbol}", status_code=204)
async def remove_watch(symbol: str) -> None:
    if not watchlist.remove(symbol):
        raise HTTPException(status_code=404, detail="Symbol not on watchlist")


@app.get("/api/holdings", response_model=list[Holding])
async def get_holdings() -> list[Holding]:
    return portfolio.list_holdings()


@app.post("/api/holdings", response_model=Holding, status_code=201)
async def create_holding(h: HoldingIn) -> Holding:
    return portfolio.add_holding(h)


@app.delete("/api/holdings/{holding_id}", status_code=204)
async def remove_holding(holding_id: int) -> None:
    if not portfolio.delete_holding(holding_id):
        raise HTTPException(status_code=404, detail="Holding not found")


@app.get("/api/portfolio", response_model=PortfolioSummary)
async def get_portfolio() -> PortfolioSummary:
    return await portfolio.get_summary()


@app.get("/api/portfolio/brief", response_model=Brief)
async def portfolio_brief() -> Brief:
    summary = await portfolio.get_summary()
    return await ai.generate_brief(summary)
