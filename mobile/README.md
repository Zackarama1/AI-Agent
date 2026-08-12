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

## Screens

- **Portfolio** — total value, today's move, all-time gain, the ✨ AI Daily Brief,
  and a tappable list of holdings. Pull to refresh.
- **Stock Detail** — live quote, OHLC stats, and latest news.
- **Add Holding** — ticker, shares, average cost.

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
