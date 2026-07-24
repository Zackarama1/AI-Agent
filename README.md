# Concierge — AI Reservations app

**Speak or type a request → an AI agent books the reservation for you →
it lands on your live calendar.** This repo now contains three layers, built
in order:

- **Step 1 — Reliability harness** (`agent.py`, `run_reliability_test.py`):
  proves a Claude-driven browser agent can complete real tasks. Still here.
- **Step 2 — Local server + PWA** (`webserver.py`, `web/`): the agent behind an
  HTTP API, served as an installable mobile app.
- **Step 3 — The Concierge product** (`nlu.py`, `store.py`, and the rebuilt
  `web/`): natural-language/voice booking, a confirmation step, a live
  calendar with `.ics` phone sync, and two booking mechanisms (AI form-filling
  now; AI phone calls as a wired-up stub).

**Quick start:**

```bash
pip install -r requirements.txt
python webserver.py                       # http://0.0.0.0:8000
# open http://localhost:8000 (or http://<your-ip>:8000 on your phone)
```

With no `ANTHROPIC_API_KEY` set, everything runs in a **scripted dry-run** (real
browser, no model, no cost) against a built-in local form — so you can see the
whole app work immediately. Add your key to `.env` for real AI bookings.

Jump to **[Getting the rest online](#getting-the-rest-online-what-you-still-need)**
for the exact APIs, keys, and deployment steps to finish the product.

---

## Step 1: Reliability harness

This validates that an AI agent can reliably complete real-world tasks
(reservations, form sign-ups) before building the full product around it.

It does NOT build the product yet. It's a small, disposable test harness that:
1. Points a Claude-driven browser agent at a real site
2. Gives it a plain-language task ("book a table for 2 at 7pm")
3. Lets it act via a small set of browser tools (navigate, click, fill, read page)
4. Logs whether it succeeded, failed, or needed human help
5. Repeats across multiple sites/tasks so you get a real success-rate number

That success-rate number is the thing that tells you whether to keep building.

## Safety / ground rules baked into this code

- **No real payments.** The `submit_payment` tool is stubbed to always log-only —
  it never actually submits card details. Don't remove that stub until you've
  built the real vault/Stripe flow deliberately.
- **Use test accounts, not your real accounts**, when trying real sites.
- **Respect robots.txt / ToS.** This harness does polite, human-paced actions
  (no parallel hammering, no CAPTCHA bypass, no queue circumvention). It is
  built for the "stay within the rules" version of the product — see the task
  config for site-by-site notes on what's actually allowed.

## Setup

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium

cp .env.example .env
# then edit .env and add your ANTHROPIC_API_KEY
```

## Run a single task (for debugging, watch it work)

```bash
python agent.py --task tasks/example_form_signup.yaml --headed
```

`--headed` opens a visible browser window so you can watch the agent work.
Drop it for headless runs.

## Run the full reliability test (Step 1's actual output)

```bash
python run_reliability_test.py --tasks tasks/ --repeats 5
```

This runs every task file in `tasks/` `--repeats` times each, and writes
`results.csv` with one row per attempt: task, attempt #, outcome
(success/fail/needs_human), steps taken, and a short note. That CSV is your
answer to "does this actually work reliably" — if you're not seeing >90%
success on the happy path, that's the signal to fix the agent loop before
building anything else.

## Step 2: the app (local server + mobile web app)

Once the agent works, this is where you start building the product. There's now
a small **FastAPI server** that wraps the agent and a **mobile-first web app**
(an installable PWA) that talks to it. Same browser tools, same agent loop —
just reachable from your phone instead of the command line.

```bash
pip install -r requirements.txt   # now includes fastapi + uvicorn
python webserver.py               # serves on http://0.0.0.0:8000
```

Open `http://localhost:8000` on the same machine, or
`http://<your-computer-ip>:8000` from your phone on the same Wi-Fi. On the
phone, use the browser's **"Add to Home Screen"** to install it like a native
app (standalone window, icon, offline shell).

What you get:
- Pick a task template (or type your own), hit **Run agent**, and watch every
  step stream in live (navigate / read / click / fill / result).
- A built-in **local demo form** (`/demo/form`) so you can see a full green run
  with **no API key and no external site** — great for demos and for developing
  the UI. This is the default template.
- **Dry-run vs. live**: with no `ANTHROPIC_API_KEY` set, runs use a scripted
  dry-run (real browser, no model). Set your key in `.env` and untick "Force dry
  run" to drive the task with Claude for real.

### API (if you want to build a different client on top)

| Method | Route | Purpose |
| ------ | ----- | ------- |
| `GET`  | `/api/health` | `{ok, has_key}` |
| `GET`  | `/api/tasks` | task templates for the picker |
| `POST` | `/api/runs` | start a run: `{instruction, start_url, mode}` → `{id, mode}` |
| `GET`  | `/api/runs/{id}` | run summary (status/outcome/steps) |
| `GET`  | `/api/runs/{id}/stream` | Server-Sent Events, one per agent step |

`mode` is `auto` (real if a key is set, else dry-run), `real`, or `dry_run`.

### Going fully native later

The web app is deliberately a thin client over that API, so the path to a real
native app (Expo / React Native) is: keep this server as the backend, and have
the native app call the same `/api/runs` + `/api/runs/{id}/stream` endpoints.
Nothing server-side has to change.

> Note for containers/servers: set `PLAYWRIGHT_CHROMIUM_PATH` to pin the
> Chromium binary if it lives at a fixed path. On a normal dev machine leave it
> unset — Playwright uses the browser from `playwright install chromium`.

## Step 3: the Concierge app (what's built now)

Open the app and you get three tabs:

- **Ask** — a big mic button (voice, via the browser's Web Speech API) and a
  text box. Say *"book a table for 2 at Nopa this Friday at 7"*. The server
  parses it into a structured booking (`POST /api/parse`), and you get an
  **editable confirmation card** with a confidence score and any assumptions it
  made ("Assumed a party of 2"). You confirm, tweak, then either **Book with
  AI** or **Call venue**.
- **Calendar** — a day strip with dots on booked days and an agenda grouped by
  Today / Tomorrow / date, with status pills (Draft → Booking… → Confirmed).
  **Add to phone** subscribes iOS/Android to `GET /api/reservations.ics`.
- **Activity** — full booking history; tap any reservation for detail / cancel.

"Book with AI" runs the browser agent live and streams every step into a bottom
sheet; on success the reservation flips to **Confirmed** and appears on the
calendar. All bookings persist in a local SQLite DB (`data/app.db`).

### How the natural-language parsing works

`nlu.py` has two paths, same output shape:
- **With `ANTHROPIC_API_KEY`** — Claude extracts the intent via tool-use with a
  strict schema, resolving "tonight" / "this Friday" to real dates.
- **Without a key** — a regex + date grammar fallback, so the demo and offline
  dev still produce a sensible intent.

### Booking mechanisms

- **AI form-filling (built):** the agent drives a real browser to complete the
  venue's booking form — including **dropdowns** (party size / time via the
  `select_option` tool), **availability slots**, and multi-step flows. Leave a
  reservation's `start_url` blank and it books the built-in demo restaurant
  (`/demo/reserve`: party/date/time → availability → guest details → confirm);
  point it at a real page to book that.
- **Per-venue adapters (`adapters.py`):** a small registry that maps a URL/venue
  to a `start_url` plus short, site-specific hints injected into the agent's
  task (e.g. how OpenTable/Resy/Tock time pickers behave). Add an entry per site
  you support; unknown sites pass through generically.
- **AI phone call (stub):** `POST /api/reservations/{id}/call` returns
  `configured: false` until you wire a voice provider — see below.

> The keyless **dry-run** now walks the whole multi-step reservation itself
> (sets the dropdowns, checks availability, picks the requested time — skipping
> unavailable slots — fills guest details and confirms), so you can watch a full
> booking with no API key. With a key set, the real Claude agent does the same
> with judgement.

## Getting the rest online (what you still need)

This is the honest map from "works on my laptop" to "real product on the App
Store." Nothing below is wired to secrets in this repo — you add the keys.

### 1. Turn on the real AI agent
- Set `ANTHROPIC_API_KEY` in `.env`. That alone flips parsing **and** booking
  from dry-run to live (`claude-sonnet-5`).
- For booking real sites at scale you want a **hosted headless browser** instead
  of a local Playwright process: **Browserbase** (built for exactly this) or
  your own pool of Playwright workers. Set `PLAYWRIGHT_CHROMIUM_PATH` or swap
  `BrowserSession.start()` to connect over CDP to the hosted browser.

### 2. The reservation "backends" — read this first
There is **no public booking API** for the big consumer platforms:
- **OpenTable** — no open booking API; access is partner/affiliate only and
  gated. **Resy** and **Tock** — private APIs, no public program.
- So the product's real mechanism is what's already here: **an AI agent that
  fills the venue's own form**, plus **an AI that phones the venue**. That's the
  moat, not a missing API key.
- Where a venue *does* expose something (some use **Tock**, **SevenRooms**,
  **Yelp Reservations/Guest Manager**, or a plain web form), add a per-site
  adapter. The cleanest next step is a small `adapters/` layer keyed by domain,
  each returning a `start_url` + any site-specific hints for the agent.

### 3. Phone-agent mode (AI calls the restaurant)
Wire `POST /api/reservations/{id}/call` to a voice stack. Two routes:
- **Fastest:** a turnkey voice-agent API — **Vapi**, **Bland.ai**, or
  **Retell** — you POST a phone number + a prompt, they place the call with a
  realtime voice model. Store the provider key server-side.
- **Most control:** **Twilio Voice** + **Media Streams** into a realtime
  speech model (STT → LLM → TTS). More work, fully yours.
- **Compliance (do not skip):** several US states require disclosing that the
  caller is an AI and/or two-party consent to record. Add a spoken AI
  disclosure, respect state rules, and honor each venue's terms. Keep the
  `submit_payment` stub stubbed until you deliberately build a real vault.

### 4. Calendar integration on the device
- **Now:** the `.ics` feed works — "Add to phone" opens a subscribe-able
  calendar URL on iOS and Android.
- **Deeper (native):** two-way sync via **Google Calendar API** (OAuth) and
  Apple **EventKit** (in the native wrapper, below).

### 5. Voice
- **Now:** the Web Speech API gives you speech-to-text in the PWA for free.
- **Higher quality / offline:** stream mic audio to **Whisper** (or Deepgram)
  and keep the same `/api/parse` call.

### 6. Ship it as a native iOS/Android app
The app is a thin client over the API, so the shortest path to the App Store is
to **wrap this exact web app with [Capacitor](https://capacitorjs.com/)** — you
get native shells, push notifications, and native calendar/mic plugins without a
rewrite. (A from-scratch **Expo / React Native** client is the alternative; it
calls the same endpoints.) Point the wrapper at your deployed API URL.

### 7. Make it multi-user and deploy
- **Accounts + auth:** add users (e.g. Auth0/Clerk or your own), scope
  reservations per user, and store their name/phone once.
- **Database:** swap `store.py`'s SQLite body for **Postgres** (managed:
  Supabase/Neon/RDS). The function signatures can stay the same.
- **Background jobs:** move agent runs onto a queue (Redis + a worker) so a
  booking survives the request and can retry; replace the in-memory `jobs.py`
  event store with Redis pub/sub for the SSE stream.
- **Host:** deploy the FastAPI app on **Fly.io / Render / Railway** behind
  HTTPS; put secrets in the platform's secret manager, never in git.
- **Observability:** log every run's outcome (you already have the reliability
  harness — run it in CI against staging to catch regressions).

### Suggested build order
1. `ANTHROPIC_API_KEY` → real bookings on the demo form. *(done the moment you
   add the key.)*
2. One real venue adapter + Browserbase → a real end-to-end booking.
3. Capacitor wrapper → the app on your own phone, installed natively.
4. Accounts + Postgres + a host → other people can use it.
5. Phone-agent provider (with AI disclosure) → the "it calls for you" feature.

## Handing this off to Claude Code to extend

This harness is intentionally minimal — a few hundred lines, one browser tool
set, one agent loop. It's meant to be a starting point Claude Code can build
on directly. Good next prompts to give Claude Code from here:

- "Add a new tool for reading dropdown/select options on the page and add a
  test task for booking on OpenTable specifically."
- "Add retry logic: if a step fails, let the agent see the error and try a
  different approach before giving up."
- "Turn `run_reliability_test.py`'s output into a simple HTML report."
- "Add a `propose_then_confirm` mode where the agent stops and asks before
  the final submit step, and log how often a human would have corrected it."
- "Replace the stubbed payment tool with real Stripe test-mode tokenization."

## File structure

```
booking-agent-poc/
├── agent.py                 # The Claude-driven agent loop (CLI)
├── browser_tools.py         # Playwright-backed tools the agent can call
├── run_reliability_test.py  # Batch runner across tasks/repeats -> results.csv
├── webserver.py             # FastAPI local server: REST + SSE + reservations
├── agent_service.py         # Async agent runner (real + dry-run) that yields events
├── jobs.py                  # In-memory run store, fans events out to SSE clients
├── nlu.py                   # Natural-language/voice -> structured booking intent
├── store.py                 # SQLite reservations + .ics calendar export
├── adapters.py              # Per-venue booking adapters (start_url + hints)
├── web/                     # The Concierge PWA (assistant + calendar + activity)
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── manifest.webmanifest
│   ├── sw.js                # service worker (installable / offline shell)
│   ├── icon.svg
│   ├── demo_form.html       # built-in signup practice form (/demo/form)
│   └── reserve_demo.html    # built-in reservation practice flow (/demo/reserve)
├── data/                    # runtime SQLite db (gitignored)
├── tasks/
│   ├── example_form_signup.yaml
│   └── example_reservation.yaml
├── requirements.txt
├── .env.example
└── README.md
```
