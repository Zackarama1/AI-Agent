# StockSense API

FastAPI backend that powers the StockSense mobile app: live market data, a
paper-trading engine (virtual cash, market orders, positions derived from
fills), and Claude-powered insights — all behind per-user auth.

## Live data with no API key

Market data defaults to **Yahoo Finance's public API — real quotes, history,
and news with no key required**. On a normal network it works out of the box.
In an offline/locked-down environment it automatically falls back to
deterministic mock data, so the app never hard-fails. Set `MARKET_PROVIDER`
to `finnhub` (with a key), `yahoo`, or `mock` to override.

## Paper trading

Every user starts with virtual cash (`STARTING_CASH`, default $100k). Orders
fill immediately at the current live price; positions and average cost are
**derived by replaying fills**, so there's no holdings table to drift.

## Setup

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # optional — live data works with no keys
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Interactive docs at http://localhost:8000/docs.

## Endpoints

Everything below `/api/auth/*` and the market-data reads (`quote`, `news`,
`history`, `search`) is public; every other route needs an
`Authorization: Bearer <token>` from login and is scoped to that user.

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/api/health` | Status + which integrations are live |
| POST | `/api/auth/register` | Create account `{email, password}` → token |
| POST | `/api/auth/login` | Log in `{email, password}` → token |
| GET  | `/api/auth/me` | Current user (requires token) |
| GET  | `/api/quote/{symbol}` | Real-time quote |
| GET  | `/api/news/{symbol}` | Recent company news |
| GET  | `/api/account` | Paper account: cash, positions, P/L, totals |
| POST | `/api/orders` | Place a market order `{symbol, side, quantity}` |
| GET  | `/api/orders` | Trade history |
| POST | `/api/account/reset` | Reset to starting cash, clear trades |
| GET  | `/api/portfolio` | Alias of `/api/account` (the app's portfolio view) |
| GET  | `/api/portfolio/brief` | Claude's daily "what happened & why" |
| GET  | `/api/history/{symbol}?days=` | Daily OHLC candles for charts |
| GET  | `/api/search?q=` | Ticker / company symbol search |
| GET  | `/api/calendar/earnings` | Upcoming earnings for your holdings + watchlist |
| GET  | `/api/watchlist` | Watched symbols with live quotes |
| POST | `/api/watchlist` | Add a symbol `{symbol}` |
| DELETE | `/api/watchlist/{symbol}` | Remove a watched symbol |
| GET  | `/api/alerts` | List price alerts |
| POST | `/api/alerts` | Create alert `{symbol, direction, target}` |
| DELETE | `/api/alerts/{id}` | Delete an alert |
| POST | `/api/alerts/check` | Evaluate alerts now (also runs on a 60s loop) |
| POST | `/api/push/register` | Register an Expo push token `{token}` |

## Keys

- **FINNHUB_API_KEY** — real-time US quotes, company news, earnings. Free tier at
  https://finnhub.io.
- **ANTHROPIC_API_KEY** — powers the AI brief. https://console.anthropic.com.
- **JWT_SECRET** — signs auth tokens. Defaults to a dev value; **set a strong
  random value in production** (passwords are PBKDF2-hashed; tokens are HS256).

## Notes / next steps

- Quotes use Finnhub REST `/quote`. A websocket stream for true tick-by-tick
  updates is the natural next step (fan out to app clients over WS).
- Storage is a single-portfolio SQLite table with no auth. Multi-user auth is a
  Phase-4 item; keep that in mind before exposing this publicly.
- Real-time exchange data carries licensing terms — check your vendor plan
  before redistributing quotes to end users.
