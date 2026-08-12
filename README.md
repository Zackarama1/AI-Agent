# StockSense 📈

An AI-first portfolio tracker — think **Apple Stocks, but it actually knows what
you own and explains it to you.**

Apple Stocks is a watchlist: a ticker, a price, a chart. StockSense tracks real
**holdings** (cost basis, live P/L, allocation) and layers on the thing Apple
structurally won't ship — a **Claude-written daily brief** that reads the day's
news for each of your positions and tells you *what happened and why* in plain
English.

## Why it's better than Apple Stocks

| Apple Stocks | StockSense |
|---|---|
| Watchlist only | Real portfolio: holdings, cost basis, live P/L, allocation |
| Generic headline feed | AI-summarized news per holding |
| Price only | Quotes + fundamentals + news, one tap away |
| No analysis | **Claude daily brief: "what happened & why"** |

## Architecture

```
mobile/   Expo (React Native + TypeScript) app  →  iOS + Android, App Store via EAS
   │  (never holds API keys)
   ▼
backend/  FastAPI (Python)
   ├── Finnhub      real-time quotes + company news
   ├── Claude       the AI daily brief
   └── SQLite       portfolio storage + live P/L math
```

The backend exists so **API keys never ship inside the app**, quotes can be
cached/streamed, and Claude is called server-side.

## Quick start

**1. Backend** (runs with zero API keys — serves mock data so you can demo instantly):

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**2. App:**

```bash
cd mobile
npm install
npx expo start          # scan the QR with Expo Go on your phone
```

On a physical phone, point the app at your computer's LAN IP:
`EXPO_PUBLIC_API_URL=http://<your-ip>:8000 npx expo start`.

See `backend/README.md` and `mobile/README.md` for details.

## APIs used

- **[Finnhub](https://finnhub.io)** — real-time US quotes, company news, earnings.
  Free tier to prototype; scale to [Polygon.io](https://polygon.io) for full
  real-time depth.
- **Claude (Anthropic API)** — the AI daily brief and news summaries.
- **Planned: [SnapTrade](https://snaptrade.com) / [Plaid Investments](https://plaid.com)**
  — link a real brokerage so holdings sync automatically.

> ⚠️ Real-time exchange data carries licensing terms. Vendor display-tier plans
> generally cover a consumer app, but check before redistributing quotes.

## Roadmap

- [x] **Phase 1 — Foundation:** FastAPI backend + Expo app shell, live quotes.
- [x] **Phase 2 — Portfolio:** holdings, cost basis, live P/L, allocation.
- [x] **Phase 3 — AI layer:** Claude daily brief + per-holding news.
- [~] **Phase 4 — Polish:** price charts ✓, watchlist ✓, symbol search ✓,
      bottom-tab navigation ✓. Still to do: push-notification alerts, earnings
      calendar, multi-user auth.
- [~] **Phase 5 — Ship:** app icon + splash ✓, `eas.json` + `app.json` build
      config ✓, backend `Dockerfile` ✓, step-by-step [`DEPLOY.md`](DEPLOY.md) ✓.
      Remaining: run the EAS build, host the backend, submit to TestFlight;
      SnapTrade brokerage sync.

## Repo history

This repository began as a browser-automation "booking agent" proof-of-concept
(`agent.py`, `browser_tools.py`, `run_reliability_test.py`, `tasks/`). Those
files remain for reference; active development is StockSense in `backend/` and
`mobile/`.
