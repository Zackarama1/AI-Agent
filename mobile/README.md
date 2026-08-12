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

## Shipping to the App Store (later)

```bash
npm install -g eas-cli
eas build --platform ios      # builds in the cloud, no Mac needed
eas submit --platform ios     # uploads to App Store Connect / TestFlight
```

You'll need an Apple Developer account ($99/yr). See the roadmap in the root
`README.md`.
