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
├── agent.py                 # The Claude-driven agent loop
├── browser_tools.py         # Playwright-backed tools the agent can call
├── run_reliability_test.py  # Batch runner across tasks/repeats -> results.csv
├── tasks/
│   ├── example_form_signup.yaml
│   └── example_reservation.yaml
├── requirements.txt
├── .env.example
└── README.md
```
