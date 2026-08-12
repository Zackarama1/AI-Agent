"""Market data: real quotes + news from Finnhub, with a mock fallback.

If FINNHUB_API_KEY is unset, every function returns deterministic pseudo-data
derived from the ticker string so the app is fully demoable offline. Swap in
a real key and the same functions hit Finnhub — no other code changes.
"""

import hashlib
import time

import httpx

from .config import settings
from .models import NewsItem, Quote

FINNHUB_BASE = "https://finnhub.io/api/v1"


def _seed(symbol: str) -> float:
    """Stable 0..1 value from a ticker, so mock prices are consistent."""
    h = hashlib.sha256(symbol.upper().encode()).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


def _mock_quote(symbol: str) -> Quote:
    s = _seed(symbol)
    base = 20 + s * 480  # $20–$500
    change = (s - 0.5) * base * 0.04  # ±2% day move
    prev = base - change
    return Quote(
        symbol=symbol.upper(),
        price=round(base, 2),
        change=round(change, 2),
        percent_change=round((change / prev) * 100, 2) if prev else 0.0,
        high=round(base * (1 + s * 0.01), 2),
        low=round(base * (1 - s * 0.01), 2),
        open=round(prev, 2),
        prev_close=round(prev, 2),
        is_mock=True,
    )


async def get_quote(symbol: str) -> Quote:
    if not settings.has_finnhub:
        return _mock_quote(symbol)

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{FINNHUB_BASE}/quote",
            params={"symbol": symbol.upper(), "token": settings.finnhub_api_key},
        )
        r.raise_for_status()
        d = r.json()

    # Finnhub returns 0s for unknown symbols; treat that as a fallback.
    if not d.get("c"):
        return _mock_quote(symbol)

    return Quote(
        symbol=symbol.upper(),
        price=d["c"],
        change=d.get("d") or 0.0,
        percent_change=d.get("dp") or 0.0,
        high=d.get("h") or d["c"],
        low=d.get("l") or d["c"],
        open=d.get("o") or d["c"],
        prev_close=d.get("pc") or d["c"],
        is_mock=False,
    )


async def get_quotes(symbols: list[str]) -> dict[str, Quote]:
    quotes: dict[str, Quote] = {}
    for sym in symbols:
        quotes[sym.upper()] = await get_quote(sym)
    return quotes


def _mock_news(symbol: str) -> list[NewsItem]:
    sym = symbol.upper()
    now = int(time.time())
    templates = [
        (f"{sym} beats quarterly estimates on strong demand",
         f"{sym} reported revenue and earnings above analyst expectations, "
         "citing resilient demand and margin improvement."),
        (f"Analysts raise price target on {sym}",
         f"Several analysts lifted their price targets on {sym} following "
         "upbeat guidance for the coming quarter."),
        (f"{sym} unveils new product line",
         f"{sym} announced an expansion of its product lineup, which management "
         "expects to contribute to growth next year."),
    ]
    return [
        NewsItem(
            headline=h,
            summary=s,
            source="MockWire",
            url="https://example.com",
            datetime=now - i * 3600,
        )
        for i, (h, s) in enumerate(templates)
    ]


async def get_company_news(symbol: str, days: int = 7) -> list[NewsItem]:
    if not settings.has_finnhub:
        return _mock_news(symbol)

    to_ts = time.time()
    frm = time.strftime("%Y-%m-%d", time.gmtime(to_ts - days * 86400))
    to = time.strftime("%Y-%m-%d", time.gmtime(to_ts))

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{FINNHUB_BASE}/company-news",
            params={
                "symbol": symbol.upper(),
                "from": frm,
                "to": to,
                "token": settings.finnhub_api_key,
            },
        )
        r.raise_for_status()
        rows = r.json()

    if not rows:
        return _mock_news(symbol)

    return [
        NewsItem(
            headline=row.get("headline", ""),
            summary=row.get("summary", ""),
            source=row.get("source", ""),
            url=row.get("url", ""),
            datetime=row.get("datetime", 0),
        )
        for row in rows[:15]
    ]
