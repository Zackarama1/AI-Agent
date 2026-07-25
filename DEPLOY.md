# Deployment runbook — taking Concierge live

This is the step-by-step to go from "runs on my laptop" to "real users book
real tables." Each stage is independent — the app works after Stage 1, and every
later stage just turns on more real capability. Nothing here needs a rewrite;
it's all environment variables.

The golden rule for the whole app: **turn one capability on, verify it, then move
on.** Every integration below falls back to a safe demo when its key is absent,
so you can ship early and light up features as you get keys.

---

## Stage 0 — What you're deploying

- A **FastAPI** backend (`webserver.py`) that serves a JSON API + Server-Sent
  Events, and the **PWA** front-end in `web/` (installable on iOS/Android).
- A native shell (`native/`, Capacitor) if you want App Store / Play Store
  builds — optional; the PWA is fully usable from the browser "Add to Home
  Screen."

You need: a host that runs Python, a Postgres database, and a domain. Budget an
afternoon.

---

## Stage 1 — Ship the app (no keys required)

The app runs today with zero keys: curated 45-restaurant catalog, simulated
("dry-run") bookings and phone calls, and confirmation emails written to
`data/outbox/` instead of sent.

Two host options, both already configured in this repo:

### Option A — Render (simplest)
1. Push this repo to GitHub.
2. On [Render](https://render.com), **New → Blueprint**, point it at the repo.
   `render.yaml` is already here — it builds and starts the web service.
3. Deploy. You get a `https://<name>.onrender.com` URL. Open it — the app loads.

### Option B — Fly.io (fast global edge)
1. `flyctl launch` (the repo has `fly.toml` + `Dockerfile`).
2. `flyctl deploy`.
3. `flyctl open`.

**Verify Stage 1:** open the URL, create an account, book a table (it animates
and lands on the calendar), open a venue → you see photos, menu highlights, and
the "Have the AI call instead" button. That's the whole app, in demo mode.

---

## Stage 2 — Real database (do this before real users)

SQLite (the default) is fine for a demo but resets on most hosts' ephemeral
disks. Move to Postgres — same schema, no code change.

1. Create a Postgres DB (managed and free-tier friendly:
   [Neon](https://neon.tech), [Supabase](https://supabase.com), or Render's own
   Postgres).
2. Set one env var on your host:
   ```
   DATABASE_URL=postgresql://user:pass@host:5432/dbname
   ```
3. Redeploy. Tables auto-create on first boot. Accounts and reservations now
   persist across restarts.

**Verify:** sign up, redeploy, sign back in — your reservations are still there.

---

## Stage 3 — Real restaurant data (every restaurant, with real photos)

Swap the built-in catalog for a live database of real venues with real photos.

- **Google Places** (recommended — best photo coverage):
  1. In [Google Cloud Console](https://console.cloud.google.com), enable the
     **Places API**, create an API key.
  2. Set:
     ```
     VENUE_PROVIDER=google
     GOOGLE_PLACES_API_KEY=...
     ```
- **Yelp Fusion** (alternative):
  1. Get a key at [Yelp Fusion](https://fusion.yelp.com).
  2. Set:
     ```
     VENUE_PROVIDER=yelp
     YELP_API_KEY=...
     ```

Either way the `/api/venues` response now carries live listings and real photo
URLs; cards and the detail sheet render the actual photography automatically.

> Note on menus: Google/Yelp don't expose a structured per-dish menu over their
> APIs, so the app shows curated **menu highlights** per cuisine. A true live
> menu needs a menu feed (e.g. a POS/menu provider); that's a later add and the
> UI section is already built for it.

**Verify:** venue cards show real photos instead of the cuisine gradient.

---

## Stage 4 — Confirmation emails

Right now emails are written to `data/outbox/`. To actually send them:

1. Pick a provider and verify a sending domain (SPF/DKIM):
   [Resend](https://resend.com) is the quickest; Postmark and SendGrid also
   supported.
2. Set:
   ```
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_...
   EMAIL_FROM=Concierge <bookings@yourdomain.com>
   ```
3. Redeploy.

Every confirmed booking now emails the guest a receipt with a calendar (`.ics`)
attachment. A failed booking emails a heads-up instead.

**Verify:** book a table, check the inbox for a confirmation with the `.ics`.

---

## Stage 5 — Real bookings (AI fills the form)

There is **no public booking API** for OpenTable / Resy / Tock — so the app books
the way a person would: an AI agent drives a real browser and fills the venue's
reservation form. This is why the agent, not an API, is the engine.

1. Set your model key (get a low-limit key first while you test):
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
2. Use a **hosted browser** in production (a real datacenter browser is far more
   reliable than a container's headless Chromium). Sign up at
   [Browserbase](https://www.browserbase.com) and set:
   ```
   BROWSERBASE_API_KEY=bb_...
   BROWSERBASE_PROJECT_ID=...
   ```
3. Map the venues you want to book for real to their reservation pages in
   `REAL_VENUE_URLS` (see `adapters.py`), then flip:
   ```
   REAL_BOOKING=1
   ```

Leave `REAL_BOOKING` unset and the app stays in the safe simulated flow — good
for a soft launch. Turn it on venue-by-venue as you confirm each form fills
cleanly.

**Verify:** with `REAL_BOOKING=1` and a mapped venue, watch the live agent steps
stream in and a real reservation land.

---

## Stage 6 — AI phone bookings

For venues that only take reservations by phone, the app can place an AI call.

1. Pick a voice provider: [Vapi](https://vapi.ai) (recommended), Bland, Retell,
   or Twilio for the carrier leg.
2. Set:
   ```
   PHONE_PROVIDER=vapi
   VAPI_API_KEY=...
   PHONE_FROM_NUMBER=+1...
   ```

**Compliance — non-negotiable:** every AI call opens with an AI-caller
disclosure (it's already wired into the call script). Several US states
(California, others) legally require disclosing that the caller is an automated
system. Do not remove it. Check the rules for the regions you operate in before
enabling real calls.

Without a provider key, `/call` runs a realistic simulated call with a
transcript so you can demo the flow safely.

**Verify:** on a phone-only venue, "Have the AI call instead" produces a live
transcript that opens with the disclosure.

---

## Stage 7 — Card on file (payments)

**Never store real card numbers on your server.** The demo wallet keeps only the
brand + last 4 digits locally, and `submit_payment` is intentionally stubbed.

To take real cards (for venues that require a card to hold a table):
1. Create a [Stripe](https://stripe.com) account.
2. Collect cards with **Stripe Elements / SetupIntents** on the client — the raw
   PAN goes straight from the browser to Stripe and **never touches your
   server**; you store only the Stripe token/customer id.
3. Implement `submit_payment` against that token when you're ready.

Until then, leave it stubbed. The UI already communicates "only the last 4 are
kept; real cards go through Stripe."

---

## Stage 8 — Domain, CORS, native apps

- **Domain:** point your domain at the host (Render/Fly both give you a CNAME).
  Serve over HTTPS (both do this automatically).
- **CORS:** if the native app or another origin calls the API, set:
  ```
  ALLOWED_ORIGINS=https://yourdomain.com,capacitor://localhost
  ```
  (or `*` while testing).
- **Native builds:** in `native/`, set `web/config.js` `API_BASE` to your live
  API URL, then `npx cap sync` and open in Xcode / Android Studio to build for
  the stores.

---

## Go-live checklist

- [ ] Stage 1: app deployed, loads over HTTPS
- [ ] Stage 2: `DATABASE_URL` set, data persists across a redeploy
- [ ] Stage 3: `VENUE_PROVIDER` + key set, real photos showing
- [ ] Stage 4: `EMAIL_PROVIDER` + verified `EMAIL_FROM`, test email received
- [ ] Stage 5: `ANTHROPIC_API_KEY` + Browserbase set; `REAL_BOOKING` on for
      mapped venues only
- [ ] Stage 6: phone provider set; AI-caller disclosure confirmed present;
      regional rules checked
- [ ] Stage 7: Stripe wired for card-on-file; server still stores no PANs
- [ ] Stage 8: domain + CORS set; native `API_BASE` pointed at prod

Ship Stage 1 today; light up the rest as the keys land.
