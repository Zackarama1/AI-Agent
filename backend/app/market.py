"""Market data: real quotes + news from Finnhub, with a mock fallback.

If FINNHUB_API_KEY is unset, every function returns deterministic pseudo-data
derived from the ticker string so the app is fully demoable offline. Swap in
a real key and the same functions hit Finnhub — no other code changes.
"""

import hashlib
import time

import httpx

from .config import settings
from .models import Candle, EarningsEvent, History, NewsItem, Quote, SearchResult

# Small universe used for offline symbol search + as a mock fallback.
_UNIVERSE = [
    ("AAPL", "Apple Inc"), ("MSFT", "Microsoft Corp"), ("NVDA", "NVIDIA Corp"),
    ("AMZN", "Amazon.com Inc"), ("GOOGL", "Alphabet Inc"), ("META", "Meta Platforms Inc"),
    ("TSLA", "Tesla Inc"), ("AMD", "Advanced Micro Devices"), ("NFLX", "Netflix Inc"),
    ("JPM", "JPMorgan Chase & Co"), ("V", "Visa Inc"), ("DIS", "Walt Disney Co"),
    ("KO", "Coca-Cola Co"), ("COST", "Costco Wholesale Corp"), ("SPY", "SPDR S&P 500 ETF"),
]

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


def _mock_history(symbol: str, days: int) -> History:
    """Deterministic random-walk series so charts render offline."""
    s = _seed(symbol)
    price = 20 + s * 480
    now = int(time.time())
    candles: list[Candle] = []
    # Simple LCG seeded by the ticker for repeatable pseudo-randomness.
    state = int(_seed(symbol) * 1_000_000) + 1
    for i in range(days, 0, -1):
        state = (1103515245 * state + 12345) % 2_147_483_648
        drift = (state / 2_147_483_648 - 0.5) * price * 0.03
        o = price
        c = max(1.0, price + drift)
        h = max(o, c) * 1.01
        low = min(o, c) * 0.99
        candles.append(
            Candle(t=now - i * 86400, o=round(o, 2), h=round(h, 2),
                   l=round(low, 2), c=round(c, 2))
        )
        price = c
    return History(symbol=symbol.upper(), candles=candles, is_mock=True)


async def get_history(symbol: str, days: int = 30) -> History:
    """Daily OHLC candles. Finnhub's candle endpoint is premium-gated, so we
    try it and fall back to a generated series on any error / empty result."""
    if not settings.has_finnhub:
        return _mock_history(symbol, days)

    to_ts = int(time.time())
    frm = to_ts - days * 86400
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{FINNHUB_BASE}/stock/candle",
                params={
                    "symbol": symbol.upper(), "resolution": "D",
                    "from": frm, "to": to_ts, "token": settings.finnhub_api_key,
                },
            )
            r.raise_for_status()
            d = r.json()
        if d.get("s") != "ok" or not d.get("c"):
            return _mock_history(symbol, days)
        candles = [
            Candle(t=d["t"][i], o=d["o"][i], h=d["h"][i], l=d["l"][i], c=d["c"][i])
            for i in range(len(d["c"]))
        ]
        return History(symbol=symbol.upper(), candles=candles, is_mock=False)
    except httpx.HTTPError:
        return _mock_history(symbol, days)


def _mock_earnings(symbol: str, days: int) -> list[EarningsEvent]:
    """A single plausible upcoming earnings date, seeded by the ticker."""
    s = _seed(symbol)
    offset = int(s * days)  # 0..days ahead
    date = time.strftime("%Y-%m-%d", time.gmtime(time.time() + offset * 86400))
    return [
        EarningsEvent(
            symbol=symbol.upper(),
            date=date,
            hour="amc" if s > 0.5 else "bmo",
            eps_estimate=round(0.5 + s * 3, 2),
            quarter=((time.gmtime().tm_mon - 1) // 3) + 1,
            year=time.gmtime().tm_year,
            is_mock=True,
        )
    ]


async def get_earnings(symbol: str, days: int = 90) -> list[EarningsEvent]:
    """Upcoming earnings for one symbol (today → +days)."""
    if not settings.has_finnhub:
        return _mock_earnings(symbol, days)

    frm = time.strftime("%Y-%m-%d", time.gmtime())
    to = time.strftime("%Y-%m-%d", time.gmtime(time.time() + days * 86400))
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{FINNHUB_BASE}/calendar/earnings",
                params={"symbol": symbol.upper(), "from": frm, "to": to,
                        "token": settings.finnhub_api_key},
            )
            r.raise_for_status()
            rows = r.json().get("earningsCalendar", [])
    except httpx.HTTPError:
        return _mock_earnings(symbol, days)

    if not rows:
        return _mock_earnings(symbol, days)

    return [
        EarningsEvent(
            symbol=symbol.upper(),
            date=row.get("date", ""),
            hour=row.get("hour", "") or "",
            eps_estimate=row.get("epsEstimate"),
            eps_actual=row.get("epsActual"),
            quarter=row.get("quarter"),
            year=row.get("year"),
            is_mock=False,
        )
        for row in rows
    ]


async def search_symbols(query: str) -> list[SearchResult]:
    q = query.strip().upper()
    if not q:
        return []
    if not settings.has_finnhub:
        return [
            SearchResult(symbol=sym, description=desc, type="Common Stock")
            for sym, desc in _UNIVERSE
            if q in sym or q in desc.upper()
        ][:10]

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{FINNHUB_BASE}/search",
            params={"q": query, "token": settings.finnhub_api_key},
        )
        r.raise_for_status()
        rows = r.json().get("result", [])

    return [
        SearchResult(
            symbol=row.get("symbol", ""),
            description=row.get("description", ""),
            type=row.get("type", ""),
        )
        for row in rows
        if row.get("symbol") and "." not in row.get("symbol", "")
    ][:15]
