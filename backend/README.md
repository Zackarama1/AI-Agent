# StockSense API

FastAPI backend that powers the StockSense mobile app. It proxies market data
and Claude (so no API keys ever ship inside the app), stores the portfolio, and
computes live P/L.

## Runs with zero keys

Every external key is **optional**. With no `.env`, the backend serves realistic
mock quotes, news, and a templated brief — so you can run the whole app before
signing up for anything. Add keys to switch on live data and AI, no code changes.

## Setup

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # optional: add FINNHUB_API_KEY / ANTHROPIC_API_KEY
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Interactive docs at http://localhost:8000/docs.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/api/health` | Status + which integrations are live |
| GET  | `/api/quote/{symbol}` | Real-time quote |
| GET  | `/api/news/{symbol}` | Recent company news |
| GET  | `/api/holdings` | Raw holdings list |
| POST | `/api/holdings` | Add a holding `{symbol, shares, cost_basis}` |
| DELETE | `/api/holdings/{id}` | Remove a holding |
| GET  | `/api/portfolio` | Holdings enriched with live quotes + totals |
| GET  | `/api/portfolio/brief` | Claude's daily "what happened & why" |

## Keys

- **FINNHUB_API_KEY** — real-time US quotes, company news, earnings. Free tier at
  https://finnhub.io.
- **ANTHROPIC_API_KEY** — powers the AI brief. https://console.anthropic.com.

## Notes / next steps

- Quotes use Finnhub REST `/quote`. A websocket stream for true tick-by-tick
  updates is the natural next step (fan out to app clients over WS).
- Storage is a single-portfolio SQLite table with no auth. Multi-user auth is a
  Phase-4 item; keep that in mind before exposing this publicly.
- Real-time exchange data carries licensing terms — check your vendor plan
  before redistributing quotes to end users.
