"""Market data with pluggable providers.

Providers (settings.market_provider, default "auto"):
  - "yahoo":   Yahoo Finance public endpoints — real quotes/history/news, NO
               API key required. This is the default and what makes the app
               show live data out of the box on a normal network.
  - "finnhub": Finnhub REST — needs FINNHUB_API_KEY.
  - "mock":    Deterministic pseudo-data from the ticker, fully offline.

Every public function tries the configured provider and falls back to mock on
any network/parse error, so the app never hard-fails (and still runs in
locked-down/CI environments with no egress).
"""

import email.utils
import hashlib
import time
import xml.etree.ElementTree as ET

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
YAHOO_BASE = "https://query1.finance.yahoo.com"
GNEWS_URL = "https://news.google.com/rss/search"
_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"


def _provider() -> str:
    return settings.provider


def _seed(symbol: str) -> float:
    """Stable 0..1 value from a ticker, so mock prices are consistent."""
    h = hashlib.sha256(symbol.upper().encode()).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


# ===========================================================================
# MOCK provider
# ===========================================================================

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
        NewsItem(headline=h, summary=s, source="MockWire",
                 url="https://example.com", datetime=now - i * 3600)
        for i, (h, s) in enumerate(templates)
    ]


def _mock_history(symbol: str, days: int) -> History:
    s = _seed(symbol)
    price = 20 + s * 480
    now = int(time.time())
    candles: list[Candle] = []
    state = int(_seed(symbol) * 1_000_000) + 1
    for i in range(days, 0, -1):
        state = (1103515245 * state + 12345) % 2_147_483_648
        drift = (state / 2_147_483_648 - 0.5) * price * 0.03
        o = price
        c = max(1.0, price + drift)
        candles.append(
            Candle(t=now - i * 86400, o=round(o, 2), h=round(max(o, c) * 1.01, 2),
                   l=round(min(o, c) * 0.99, 2), c=round(c, 2))
        )
        price = c
    return History(symbol=symbol.upper(), candles=candles, is_mock=True)


# ===========================================================================
# YAHOO provider (no API key)
# ===========================================================================

def _yahoo_range(days: int) -> tuple[str, str]:
    if days <= 7:
        return "5d", "1d"
    if days <= 31:
        return "1mo", "1d"
    if days <= 93:
        return "3mo", "1d"
    if days <= 186:
        return "6mo", "1d"
    return "1y", "1d"


async def _yahoo_chart(symbol: str, rng: str, interval: str) -> dict:
    async with httpx.AsyncClient(timeout=12, headers={"User-Agent": _UA}) as client:
        r = await client.get(
            f"{YAHOO_BASE}/v8/finance/chart/{symbol.upper()}",
            params={"range": rng, "interval": interval, "includePrePost": "false"},
        )
        r.raise_for_status()
        return r.json()["chart"]["result"][0]


def parse_yahoo_quote(symbol: str, result: dict) -> Quote:
    """Pure parser for a Yahoo chart result → Quote (unit-testable offline)."""
    m = result["meta"]
    price = m["regularMarketPrice"]
    prev = m.get("chartPreviousClose") or m.get("previousClose") or price
    return Quote(
        symbol=m.get("symbol", symbol.upper()),
        price=round(price, 2),
        change=round(price - prev, 2),
        percent_change=round(((price - prev) / prev) * 100, 2) if prev else 0.0,
        high=round(m.get("regularMarketDayHigh") or price, 2),
        low=round(m.get("regularMarketDayLow") or price, 2),
        open=round(m.get("regularMarketOpen") or prev, 2),
        prev_close=round(prev, 2),
        is_mock=False,
    )


def parse_yahoo_history(symbol: str, result: dict) -> History:
    """Pure parser for a Yahoo chart result → History (unit-testable offline)."""
    ts = result.get("timestamp", [])
    q = result["indicators"]["quote"][0]
    candles: list[Candle] = []
    for i, t in enumerate(ts):
        c = q["close"][i]
        if c is None:
            continue
        candles.append(
            Candle(
                t=t,
                o=round(q["open"][i] if q["open"][i] is not None else c, 2),
                h=round(q["high"][i] if q["high"][i] is not None else c, 2),
                l=round(q["low"][i] if q["low"][i] is not None else c, 2),
                c=round(c, 2),
            )
        )
    if not candles:
        raise ValueError("no candles")
    return History(symbol=symbol.upper(), candles=candles, is_mock=False)


async def _yahoo_quote(symbol: str) -> Quote:
    return parse_yahoo_quote(symbol, await _yahoo_chart(symbol, "1d", "1d"))


async def _yahoo_history(symbol: str, days: int) -> History:
    rng, interval = _yahoo_range(days)
    return parse_yahoo_history(symbol, await _yahoo_chart(symbol, rng, interval))


async def _yahoo_search(query: str) -> list[SearchResult]:
    async with httpx.AsyncClient(timeout=12, headers={"User-Agent": _UA}) as client:
        r = await client.get(
            f"{YAHOO_BASE}/v1/finance/search",
            params={"q": query, "quotesCount": 12, "newsCount": 0},
        )
        r.raise_for_status()
        rows = r.json().get("quotes", [])
    out = []
    for row in rows:
        sym = row.get("symbol")
        if not sym or row.get("quoteType") not in ("EQUITY", "ETF", None):
            continue
        out.append(SearchResult(
            symbol=sym,
            description=row.get("shortname") or row.get("longname") or sym,
            type=row.get("quoteType", ""),
        ))
    return out[:15]


# ===========================================================================
# GOOGLE NEWS RSS provider (no API key) — real-world headlines from every outlet
# ===========================================================================

def _rfc822_to_epoch(s: str) -> int:
    try:
        return int(email.utils.parsedate_to_datetime(s).timestamp())
    except Exception:
        return 0


def parse_google_news(xml_text: str) -> list[NewsItem]:
    """Pure parser for a Google News RSS feed → NewsItem[] (unit-testable)."""
    root = ET.fromstring(xml_text)
    items: list[NewsItem] = []
    for it in root.iter("item"):
        title = (it.findtext("title") or "").strip()
        if not title:
            continue
        link = (it.findtext("link") or "").strip()
        pub = _rfc822_to_epoch(it.findtext("pubDate") or "")
        src_el = it.find("source")
        source = (src_el.text or "").strip() if src_el is not None else ""
        # Google formats titles as "Headline - Source"; drop the trailing source.
        if source and title.endswith(f" - {source}"):
            title = title[: -(len(source) + 3)].strip()
        items.append(NewsItem(
            headline=title, summary=source, source=source or "Google News",
            url=link, datetime=pub,
        ))
    return items[:15]


async def _google_news(symbol: str) -> list[NewsItem]:
    async with httpx.AsyncClient(timeout=12, headers={"User-Agent": _UA},
                                 follow_redirects=True) as client:
        r = await client.get(
            GNEWS_URL,
            params={"q": f"{symbol.upper()} stock when:14d",
                    "hl": "en-US", "gl": "US", "ceid": "US:en"},
        )
        r.raise_for_status()
        items = parse_google_news(r.text)
    if not items:
        raise ValueError("no news")
    return items


async def _yahoo_news(symbol: str) -> list[NewsItem]:
    async with httpx.AsyncClient(timeout=12, headers={"User-Agent": _UA}) as client:
        r = await client.get(
            f"{YAHOO_BASE}/v1/finance/search",
            params={"q": symbol, "quotesCount": 0, "newsCount": 15},
        )
        r.raise_for_status()
        rows = r.json().get("news", [])
    return [
        NewsItem(
            headline=n.get("title", ""),
            summary=n.get("publisher", ""),
            source=n.get("publisher", ""),
            url=n.get("link", ""),
            datetime=int(n.get("providerPublishTime", 0)),
        )
        for n in rows
        if n.get("title")
    ][:15]


# ===========================================================================
# FINNHUB provider
# ===========================================================================

async def _finnhub_quote(symbol: str) -> Quote:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{FINNHUB_BASE}/quote",
            params={"symbol": symbol.upper(), "token": settings.finnhub_api_key},
        )
        r.raise_for_status()
        d = r.json()
    if not d.get("c"):
        raise ValueError("empty quote")
    return Quote(
        symbol=symbol.upper(), price=d["c"], change=d.get("d") or 0.0,
        percent_change=d.get("dp") or 0.0, high=d.get("h") or d["c"],
        low=d.get("l") or d["c"], open=d.get("o") or d["c"],
        prev_close=d.get("pc") or d["c"], is_mock=False,
    )


async def _finnhub_news(symbol: str, days: int) -> list[NewsItem]:
    to_ts = time.time()
    frm = time.strftime("%Y-%m-%d", time.gmtime(to_ts - days * 86400))
    to = time.strftime("%Y-%m-%d", time.gmtime(to_ts))
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{FINNHUB_BASE}/company-news",
            params={"symbol": symbol.upper(), "from": frm, "to": to,
                    "token": settings.finnhub_api_key},
        )
        r.raise_for_status()
        rows = r.json()
    if not rows:
        raise ValueError("no news")
    return [
        NewsItem(headline=row.get("headline", ""), summary=row.get("summary", ""),
                 source=row.get("source", ""), url=row.get("url", ""),
                 datetime=row.get("datetime", 0))
        for row in rows[:15]
    ]


async def _finnhub_search(query: str) -> list[SearchResult]:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{FINNHUB_BASE}/search",
            params={"q": query, "token": settings.finnhub_api_key},
        )
        r.raise_for_status()
        rows = r.json().get("result", [])
    return [
        SearchResult(symbol=row.get("symbol", ""), description=row.get("description", ""),
                     type=row.get("type", ""))
        for row in rows if row.get("symbol") and "." not in row.get("symbol", "")
    ][:15]


# ===========================================================================
# Public API — dispatch to provider, fall back to mock on any error
# ===========================================================================

async def get_quote(symbol: str) -> Quote:
    p = _provider()
    try:
        if p == "yahoo":
            return await _yahoo_quote(symbol)
        if p == "finnhub":
            return await _finnhub_quote(symbol)
    except Exception:
        pass
    return _mock_quote(symbol)


async def get_quotes(symbols: list[str]) -> dict[str, Quote]:
    quotes: dict[str, Quote] = {}
    for sym in symbols:
        quotes[sym.upper()] = await get_quote(sym)
    return quotes


async def get_history(symbol: str, days: int = 30) -> History:
    p = _provider()
    try:
        if p == "yahoo":
            return await _yahoo_history(symbol, days)
    except Exception:
        pass
    # Finnhub candles are premium-gated; mock is the fallback for both.
    return _mock_history(symbol, days)


async def get_company_news(symbol: str, days: int = 7) -> list[NewsItem]:
    """Real-world headlines. Google News RSS is tried first (keyless, aggregates
    every outlet), then the configured provider's news, then mock."""
    if settings.provider != "mock":
        # 1) Google News RSS — best real-world coverage, no key.
        try:
            return await _google_news(symbol)
        except Exception:
            pass
        # 2) Provider-specific news.
        try:
            if settings.provider == "finnhub":
                return await _finnhub_news(symbol, days)
            return await _yahoo_news(symbol)
        except Exception:
            pass
    return _mock_news(symbol)


async def search_symbols(query: str) -> list[SearchResult]:
    q = query.strip()
    if not q:
        return []
    p = _provider()
    try:
        if p == "yahoo":
            res = await _yahoo_search(q)
            if res:
                return res
        if p == "finnhub":
            res = await _finnhub_search(q)
            if res:
                return res
    except Exception:
        pass
    qu = q.upper()
    return [
        SearchResult(symbol=sym, description=desc, type="Common Stock")
        for sym, desc in _UNIVERSE if qu in sym or qu in desc.upper()
    ][:10]


# ---- Earnings (Finnhub calendar or mock; Yahoo has no clean free endpoint) --

def _mock_earnings(symbol: str, days: int) -> list[EarningsEvent]:
    s = _seed(symbol)
    offset = int(s * days)
    date = time.strftime("%Y-%m-%d", time.gmtime(time.time() + offset * 86400))
    return [EarningsEvent(
        symbol=symbol.upper(), date=date, hour="amc" if s > 0.5 else "bmo",
        eps_estimate=round(0.5 + s * 3, 2),
        quarter=((time.gmtime().tm_mon - 1) // 3) + 1, year=time.gmtime().tm_year,
        is_mock=True,
    )]


async def get_earnings(symbol: str, days: int = 90) -> list[EarningsEvent]:
    if settings.provider == "finnhub":
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
            if rows:
                return [EarningsEvent(
                    symbol=symbol.upper(), date=row.get("date", ""),
                    hour=row.get("hour", "") or "", eps_estimate=row.get("epsEstimate"),
                    eps_actual=row.get("epsActual"), quarter=row.get("quarter"),
                    year=row.get("year"), is_mock=False,
                ) for row in rows]
        except httpx.HTTPError:
            pass
    return _mock_earnings(symbol, days)
