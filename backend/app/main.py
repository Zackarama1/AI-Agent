"""StockSense API — the backend for the mobile app.

Run:  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
Docs: http://localhost:8000/docs
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import ai, market, portfolio
from .config import settings
from .models import (
    Brief,
    Holding,
    HoldingIn,
    NewsItem,
    PortfolioSummary,
    Quote,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    portfolio.init_db()
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
