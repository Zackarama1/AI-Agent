# Collabify

**Real projects for verified university students. Affordable talent for startups.**

Collabify is a two-sided marketplace that connects university students looking for remote work
experience with entrepreneurs and startups that need affordable, skilled help. This folder holds
the full working product: a React web app, a Node.js API, escrow payments, end-to-end encrypted
messaging, academic verification, matching, ratings, subscriptions and an admin console.

| | |
|---|---|
| Business plan | [`docs/BUSINESS_PLAN.md`](docs/BUSINESS_PLAN.md) |
| Launch budget (£59k) and what this build already covers | [`docs/LAUNCH_BUDGET.md`](docs/LAUNCH_BUDGET.md) |
| Architecture, security and scaling | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |

## Quick start

Requires **Node.js 22.13+** (uses the built-in `node:sqlite`, so there are no native builds).

```bash
cd collabify
npm install
npm run seed        # demo data: students, startups, jobs, contracts, encrypted chats
npm run dev         # API on :4000, web app on http://localhost:5173
```

Demo accounts (password `password123` for all):

| Role | Email | Notes |
|---|---|---|
| Student | `maya@demo.collabify.app` | Verified, Premium, has reviews and a portfolio |
| Student | `tom@demo.collabify.app` | Verified, has a funded contract in progress |
| Student | `newstudent@demo.collabify.app` | Not verified yet, so try the verification flow |
| Entrepreneur | `sara@demo.collabify.app` | Growth plan, has applicants and an encrypted chat |
| Entrepreneur | `daniel@demo.collabify.app` | Starter plan |
| Admin | `admin@collabify.app` | Revenue dashboard and dispute resolution |

In development, verification codes are shown on screen and in the server log, so no email setup is needed.

## Production

```bash
npm run build                                   # builds the React app into client/dist
JWT_SECRET=... NODE_ENV=production npm start    # API serves the app on :4000
```

Or with Docker:

```bash
docker build -t collabify .
docker run -p 4000:4000 -e JWT_SECRET=... -v collabify-data:/data collabify
```

All settings are in [`.env.example`](.env.example). The 15% commission is `PLATFORM_COMMISSION_RATE=0.15`.

## Tests

```bash
npm test
```

The API test suite covers the whole marketplace flow (post → apply → hire → fund escrow → submit
→ release → review), the 15% commission maths to the penny, permissions (who can see or move
money), academic verification, plan limits, featured listings, encrypted-message storage and the CSRF guard.

## Features → where they live

| Business plan item | Implementation |
|---|---|
| Student & entrepreneur accounts | `server/src/routes/auth.js`, `client/src/pages/Auth.jsx` |
| Academic verification (exclusive to verified students) | `server/src/routes/verification.js`: one-time code to a university email (`.ac.uk`, `.edu`, …) |
| Job posting & matching | `server/src/routes/jobs.js`, `server/src/lib/matching.js` (skills overlap + verification + rating + track record) |
| Encrypted in-app messaging | `client/src/lib/e2ee.js` (ECDH P-256 + AES-256-GCM in the browser); the server stores ciphertext only |
| Escrow payment system | `server/src/routes/contracts.js`, `server/src/payments/` (mock provider + Stripe Connect provider) |
| Ratings & reviews | `POST /api/contracts/:id/reviews`, two-way, after release |
| Portfolio integration | Completed projects are added to the student's portfolio automatically, plus manual items |
| 15% commission | `server/src/lib/money.js`, recorded per contract in an append-only ledger |
| Subscription plans | Starter / Growth £19 / Scale £49 for entrepreneurs; Student Premium £4.99 (10% fee) |
| Featured listing fees | £9.99 for 7 days pinned to the top of search |
| Admin | Revenue by stream, escrow held, dispute resolution (`/admin`) |
