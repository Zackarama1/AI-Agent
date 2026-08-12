# Shipping StockSense to the App Store

The whole path from this repo to an app on your phone (TestFlight) and then the
App Store. Two things get deployed: the **backend** (to a public URL) and the
**app** (to Apple via EAS).

---

## 0. What you'll need

- An **Apple Developer account** — $99/yr, https://developer.apple.com/programs.
  Required for TestFlight and the App Store (not for testing in Expo Go).
- A free **Expo account** — https://expo.dev.
- A host for the backend (any of Render / Railway / Fly.io / Google Cloud Run).

---

## 1. Wire in your API keys (optional but recommended)

The app works on mock data with no keys. To switch on live quotes + AI:

```bash
cd backend
cp .env.example .env
```

Fill in:
- `FINNHUB_API_KEY` — free at https://finnhub.io (real-time US quotes + news).
- `ANTHROPIC_API_KEY` — https://console.anthropic.com (the AI daily brief).

Locally, `uvicorn app.main:app --reload` picks these up. In production you set
them as environment variables on your host (step 2) — never commit `.env`.

---

## 2. Deploy the backend to a public URL

The production app can't talk to `localhost`; it needs a public HTTPS backend.
A `backend/Dockerfile` is included, so any container host works. Example with
**Render**:

1. Push this repo to GitHub (already done).
2. On Render: **New → Web Service**, point at this repo, root directory `backend`.
3. Render auto-detects the Dockerfile. Add env vars `FINNHUB_API_KEY` and
   `ANTHROPIC_API_KEY`.
4. Deploy. You'll get a URL like `https://stocksense-api.onrender.com`.
5. Sanity-check: open `https://<your-url>/api/health` — it should return
   `{"status":"ok", ...}`.

> Note: SQLite lives on the container's local disk, which is ephemeral on most
> hosts (holdings reset on redeploy). Fine for a demo/TestFlight; before public
> launch, move to a managed Postgres and add multi-user auth (Phase 4).

Put that URL into `mobile/eas.json` — replace both
`https://YOUR-DEPLOYED-BACKEND.example.com` entries with your real URL.

---

## 3. One-time EAS setup

```bash
cd mobile
npm install -g eas-cli
eas login                 # your Expo account
eas init                  # creates the EAS project, fills in extra.eas.projectId
```

`eas init` writes the real `projectId` into `app.json` (replacing the
`REPLACE_WITH_EAS_PROJECT_ID` placeholder).

---

## 4. Build for iOS (in the cloud — no Mac needed)

```bash
eas build --platform ios --profile production
```

EAS handles signing (it can create the certificates and provisioning profiles
for you — just log in with your Apple ID when prompted). When it finishes you
get a `.ipa` built in Expo's cloud.

To test on the iOS Simulator instead (faster, no Apple account needed):

```bash
eas build --platform ios --profile preview   # simulator build
```

---

## 5. Submit to TestFlight

```bash
eas submit --platform ios --profile production
```

This uploads the build to **App Store Connect**. Then:

1. Go to https://appstoreconnect.apple.com → your app → **TestFlight**.
2. Add yourself (and testers) — they install the **TestFlight** app and get the
   build. This is the "on my actual phone" moment.

---

## 6. App Store release (when ready)

In App Store Connect: fill in the listing (screenshots, description, privacy
details), attach the build, and submit for review. Financial apps get scrutiny
on **data licensing** and **not giving financial advice** — the app is written
to *describe*, never *advise*, which keeps it on the right side of that.

---

## Quick reference

| Step | Command |
|------|---------|
| Deploy backend | Docker host (Render/Railway/Fly/Cloud Run) |
| Login | `eas login` |
| Init project | `eas init` |
| iOS build | `eas build --platform ios --profile production` |
| Simulator build | `eas build --platform ios --profile preview` |
| Submit | `eas submit --platform ios --profile production` |
| Android build | `eas build --platform android --profile production` |
