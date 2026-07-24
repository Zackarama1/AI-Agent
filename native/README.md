# Concierge — native iOS & Android (Capacitor)

This wraps the exact web app (`../web`) in a native shell so you can ship it to
the App Store and Play Store, with a native icon, splash screen, and access to
native plugins (push, calendar, mic) later. It talks to your **deployed** API.

Everything here except the final device build has been verified; `www/`,
`node_modules/`, `ios/`, and `android/` are generated (gitignored).

## Prerequisites

- Node 18+ and npm
- **iOS:** macOS with Xcode
- **Android:** Android Studio (with an SDK + emulator or a device)

## One-time setup

```bash
cd native
npm install

# Bundle the web app and point it at your deployed API (from the deploy step):
API_BASE=https://your-app.fly.dev npm run sync:web

# Add the platforms you want:
npx cap add ios
npx cap add android

# Generate the app icon + splash from assets/ (brand art already included):
npm run icons
```

## Each time you change the web app or the API URL

```bash
API_BASE=https://your-app.fly.dev npm run sync   # re-bundle + cap sync
```

## Build / run on a device

```bash
npx cap open ios        # opens Xcode      -> Run
npx cap open android    # opens Android Studio -> Run
```

## How it's wired

- `sync-web.sh` copies `../web` into `www/` and overwrites `www/config.js` with
  `window.APP_CONFIG = { apiBase: "<API_BASE>" }`. The web app routes every
  `fetch`/`EventSource`/calendar link through that base (see `web/app.js`), so
  the bundled native app calls your deployed server. The server already sends
  permissive CORS headers for the native origin.
- `assets/icon.png` (1024²) and `assets/splash.png` (2732²) are the brand
  source art; `npm run icons` fans them out to every platform density.

## Quick alternative: remote-URL shell (no re-bundling)

To test fast, point the shell straight at the live site instead of bundling.
Add this to `capacitor.config.json`, then `npx cap sync`:

```json
"server": { "url": "https://your-app.fly.dev", "cleartext": false }
```

Good for a demo; for a store submission, prefer the bundled-assets flow above so
the shell still opens if the network is slow.

## Voice, calendar & push (native upgrades)

The web app already does speech-to-text via the browser. When you want deeper
native features, add Capacitor plugins and call them from `web/app.js`:

- `@capacitor/push-notifications` — booking status alerts
- a calendar plugin (or Google Calendar API) — two-way sync beyond the `.ics`
- `@capacitor/haptics`, `@capacitor/status-bar` — polish
