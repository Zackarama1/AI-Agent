# StockSense Mobile

Expo (React Native + TypeScript) app. Cross-platform iOS + Android, ships to the
App Store via EAS Build — no Mac required.

## Setup

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app on your phone, or press `i` / `a` for a
simulator.

## Connecting to the backend

The app talks to the FastAPI backend (default `http://localhost:8000`).

> **On a physical phone, `localhost` is the phone itself, not your computer.**
> Point the app at your machine's LAN IP:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:8000 npx expo start
```

(Find your IP with `ipconfig getifaddr en0` on macOS or `hostname -I` on Linux.)

## Auth & modes

- Sign in with email/password on first launch; the token is stored in
  `expo-secure-store` and each user's data is kept separate.
- Toggle **Simple** / **Advanced** layouts in-app (persisted per device).

## Paper trading

Every account starts with $100k of virtual cash. Buy/sell at live prices from
any stock's detail screen; positions, average cost, and P/L are computed from
your fills. **Activity** shows the trade log and can reset the account.

## Screens

- **Portfolio** — Simple: account value, today's move, total P/L, cash / buying
  power, the ✨ AI Daily Brief, tappable positions. Advanced: greeting, gradient
  balance hero, quick actions, performance sparkline, positions with allocation.
- **Watchlist** — followed symbols with live quotes.
- **Earnings** — upcoming earnings dates for your positions + watchlist.
- **Search** — debounced ticker/company lookup.
- **Stock Detail** — live quote, chart (1W/1M/3M), **Buy/Sell**, alerts, news.
- **Trade** — buy/sell with a live estimate against your buying power.
- **Activity** — trade history + reset paper account.

## App assets

Icon / splash / adaptive-icon PNGs live in `assets/` and are generated from
brand colors by `scripts/make_assets.py` (run `python scripts/make_assets.py`
from `mobile/` after tweaking colors). `app.json` and `eas.json` are already
wired for EAS builds.

## Shipping to the App Store

Full step-by-step — backend hosting, EAS setup, TestFlight, App Store — is in
[`../DEPLOY.md`](../DEPLOY.md). Short version:

```bash
npm install -g eas-cli
eas login && eas init                          # one-time
eas build  --platform ios --profile production # cloud build, no Mac needed
eas submit --platform ios --profile production # → App Store Connect / TestFlight
```

You'll need an Apple Developer account ($99/yr).
