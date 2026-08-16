# TradeShield — PTC Client App

A commercial, mobile-first **Live Liability Control** app, built to the TradeShield
PTC Client Guide. It gives an adviser / PTC operator a live view of each client
company's recorded operating liabilities — what's due, what's funded, who's
responsible and what must happen next.

Self-contained: no build step, no backend required to run. State persists in the
browser, so the whole product is demonstrable offline. It's a **PWA** (installable
to a phone home screen) and **Capacitor-ready**, which is the path to the App Store.

## Run it

```bash
cd app
python -m http.server 8000
# open http://localhost:8000  (use a phone-sized viewport / device toolbar)
```

Any credentials sign you in (demo auth). To reset the demo data, clear the site's
local storage.

## What's in it (mapped to the Client Guide)

| Screen | Guide section |
|--------|---------------|
| **Portfolio** | Multi-client overview — total recorded, due next 7 days, overdue, funding gap |
| **Client dashboard** | §3 Financial position — 4 KPIs, funding donut (allocated / reserved / shortfall), accounting feed |
| **Liability register** | §4 The core record — each row taps into a full record |
| **Liability record** | Lifecycle track (Recorded → Approved → Funded → Paid → Reconciled), evidence files, full audit history |
| **Action Centre** | §6 Turn information into a named action — Approval / Document / Decision / Review, prioritised, escalation |
| **Insights** | Lifecycle distribution, liabilities by domain (HMRC / People / Supply / Risk), funding trend |
| **Connect** | Xero & QuickBooks integration + sync activity |
| **Account** | §8 Roles (Client Director, Finance User, PTC Operations, Adviser) + §12 compliance boundaries |
| **Client outputs** | Board report, Liability export, Funding report, Evidence pack (CSV export) |

Core interactions work: advance a liability through its lifecycle, complete an
action (which advances the linked liability and writes to the audit trail),
connect an accounting provider (simulated OAuth), export reports, switch clients.

## Files

```
app/
├── index.html        # SPA shell + PWA meta
├── manifest.json     # installable app manifest
├── sw.js             # service worker (offline shell cache)
└── assets/
    ├── app.css       # immersive dark design system
    ├── data.js       # demo data model (clients, liabilities, actions)
    └── app.js        # SPA: router + all screens + interactions
```

## Going to production

The front end is complete and on-model. To commercialise, three pieces need your
accounts / a small backend — the app is structured so they slot in:

1. **App Store** — wrap this PWA with **Capacitor** (`npx cap add ios`), open in
   Xcode, sign with an Apple Developer account, submit. No rewrite needed.
2. **Live Xero / QuickBooks** — create developer apps, run the OAuth flow through a
   backend that holds tokens securely, and map their bills/tax/payroll data into the
   liability register. `simulateConnect()` / the sync engine mark the exact seam.
3. **Multi-tenant auth + billing** — a backend (auth + database) and **Stripe** for
   subscriptions. The login, roles and plan screens are the front end for this.

## Compliance note

Per the Client Guide, the app is a **control platform, not a substitute for
judgement or legal duties**: recording or approving a liability does not itself pay
or discharge it, officer duties remain, and scope is contractual. These boundaries
are surfaced in the Account screen.

> Illustrative interface using example data.
