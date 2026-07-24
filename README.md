# Booking Agent PoC — Reliability Test Harness

This is Step 1 of the plan: **validate that an AI agent can reliably complete
real-world tasks (reservations, form sign-ups) before building the full
product around it.**

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
├── webserver.py             # FastAPI local server: REST + live step streaming
├── agent_service.py         # Async agent runner (real + dry-run) that yields events
├── jobs.py                  # In-memory run store, fans events out to SSE clients
├── web/                     # Mobile-first PWA (the app)
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── manifest.webmanifest
│   ├── sw.js                # service worker (installable / offline shell)
│   ├── icon.svg
│   └── demo_form.html       # built-in local practice form (/demo/form)
├── tasks/
│   ├── example_form_signup.yaml
│   └── example_reservation.yaml
├── requirements.txt
├── .env.example
└── README.md
```
