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
| Watchlist only | **Paper trading**: buy/sell with virtual cash, real fills |
| No holdings | Positions with live P/L, average cost, allocation |
| Generic headline feed | Live per-stock news + AI-summarized brief |
| Price only | Live quotes + charts + news + earnings, one tap away |
| No analysis | **Claude daily brief: "what happened & why"** |
| One fixed UI | **Simple** (clean) and **Advanced** (fintech dashboard) modes |

## Live data + paper trading

- **Live market data with no API key.** Quotes, charts, and news come from
  Yahoo Finance's public API by default — real data, out of the box. Falls back
  to mock data offline; switch to Finnhub with a key via `MARKET_PROVIDER`.
- **Paper trading.** Every account starts with $100k of virtual cash. Buy and
  sell at live prices; positions and average cost are derived from your fills,
  with a full activity log. Reset anytime.

## Two UI modes

The app ships two layouts you can toggle in-app (persisted per device):

- **Simple** — a clean, glanceable portfolio: total, day/all-time P/L, AI brief,
  holdings list.
- **Advanced** — a data-dense dashboard styled after a modern fintech app:
  greeting, gradient balance hero, quick actions, a performance sparkline, and
  an assets breakdown.

Both sit behind email/password sign-in, with each user's data kept separate.

## Architecture

```
mobile/   Expo (React Native + TypeScript) app  →  iOS + Android, App Store via EAS
   │  (never holds API keys)
   ▼
backend/  FastAPI (Python)
   ├── Yahoo/Finnhub  live quotes, charts, news (Yahoo needs no key)
   ├── Trading        paper account: cash, market orders, derived positions
   ├── Claude         the AI daily brief
   └── SQLite         accounts, trades, watchlist, alerts (per-user)
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

- **Yahoo Finance public API** — live quotes, history, and news. No key needed;
  the default provider.
- **[Finnhub](https://finnhub.io)** — optional alternative (needs a key); adds an
  earnings calendar. Scale to [Polygon.io](https://polygon.io) for full depth.
- **Claude (Anthropic API)** — the AI daily brief and news summaries.

> ⚠️ Yahoo's endpoints are unofficial and rate-limited — fine for a personal /
> paper-trading app; use a licensed vendor (Finnhub/Polygon) for production
> traffic. Real-time exchange data also carries licensing terms; check your
> vendor plan before redistributing quotes.

## Roadmap

- [x] **Phase 1 — Foundation:** FastAPI backend + Expo app shell, live quotes.
- [x] **Phase 2 — Portfolio:** holdings, cost basis, live P/L, allocation.
- [x] **Phase 3 — AI layer:** Claude daily brief + per-position news.
- [x] **Reinvention — real app:** live Yahoo data (no key), paper-trading engine
      (buy/sell, derived positions, activity log), trade UI + account views.
- [~] **Phase 4 — Polish:** price charts ✓, watchlist ✓, symbol search ✓,
      bottom-tab navigation ✓, push-notification price alerts ✓, multi-user
      auth ✓ (email/password, JWT, per-user data), Simple/Advanced UI modes ✓,
      earnings calendar ✓. Still to do: managed DB for production scale.
- [~] **Phase 5 — Ship:** app icon + splash ✓, `eas.json` + `app.json` build
      config ✓, backend `Dockerfile` ✓, step-by-step [`DEPLOY.md`](DEPLOY.md) ✓.
      Remaining: run the EAS build, host the backend, submit to TestFlight;
      SnapTrade brokerage sync.

## Repo history

This repository began as a browser-automation "booking agent" proof-of-concept
(`agent.py`, `browser_tools.py`, `run_reliability_test.py`, `tasks/`). Those
files remain for reference; active development is StockSense in `backend/` and
`mobile/`.
