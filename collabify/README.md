# Collabify (iOS app)

UK students and startups, working together on short paid projects. Built with Expo SDK 58 + Expo Router,
backed by Supabase and Stripe Connect. See `CLAUDE.md` for the product rules and design brief.

## Run it

```bash
npm install
npx expo start          # press i for the iOS simulator, or scan the QR code with Expo Go
```

With no Supabase env vars set, the app runs in **demo mode**: an in-memory store with fictional
businesses, students and projects. On the welcome screen, tap a demo account (Student · Maya,
Business · Brewbox, Admin). The one-time code is shown on screen. Demo data resets when the app reloads.

Checks:

```bash
npx tsc --noEmit
npx expo lint
npm test                       # fee maths and the demo store's rules (Jest)
supabase/tests/run.sh          # database rules, against a local Postgres (see below)
```

## What's built

| Area | Where |
|---|---|
| Welcome → email one-time code (students must use `.ac.uk`) → onboarding | `src/app/welcome.tsx`, `sign-in.tsx`, `onboarding.tsx` |
| Student: Projects feed (match %), apply, My work (deliver files), Profile + payouts | `src/app/student/*`, `project/[id].tsx`, `contract/[id].tsx` |
| Business: Projects (applicants, shortlist, hire, pay, approve), Post (templates + AI brief + live fee preview, £12.71/h minimum), Profile + plans | `src/app/business/*`, `plans.tsx` |
| Messages per project, blind reviews, public profiles | `chat/[id].tsx`, `contract/[id].tsx`, `people/[id].tsx` |
| Ask for changes after a delivery (payment stays held, auto-pay pauses), cancel an unpaid hire, cancel a project, withdraw an application, open delivered files | `contract/[id].tsx`, `project/[id].tsx` |
| Report a problem → admin pays the student or refunds the business | `contract/[id].tsx`, `admin.tsx`, `resolve-dispute` |
| Notifications: activity feed with unread badge, and push to phones (applications, hires, payment held, deliveries, changes, payments, problems, messages, reviews) | `activity.tsx`, `src/lib/push.ts`, notification triggers, `send-push` |
| Account deletion (refused while payment is held) | `DeleteAccount.tsx`, `delete-account` |
| Featured listings (£19, 7 days) and Startup Pro / Scale plans, sold through Stripe Checkout in the browser | `project/[id].tsx`, `plans.tsx`, `billing-checkout` |
| Admin hand-matching + metrics (fill rate, time to match, repeat clients) | `src/app/admin.tsx` |
| One `Api` interface, two implementations | `src/lib/api.ts`, `src/lib/demo/store.ts`, `src/lib/supabase/api.ts` |
| Fees and rules | `src/lib/fees.ts` (12% / 8% / 5% on top, students keep 100%) |
| Database, RLS, hiring/delivery/review functions | `supabase/migrations/` |
| Stripe Connect + AI brief writer | `supabase/functions/` |

## Go live (real Supabase + Stripe test mode)

1. Create free accounts at supabase.com and stripe.com. You need two keys:
   - a Supabase personal access token (Account → Access Tokens)
   - your Stripe **test** secret key (`sk_test_…`)
2. Run:
   ```bash
   SUPABASE_ACCESS_TOKEN=... STRIPE_SECRET_KEY=sk_test_... [ANTHROPIC_API_KEY=...] npm run go-live
   ```
   The script:
   - creates the Supabase project (London) and applies all migrations
   - sets up the 6-digit sign-in emails
   - creates the £29 and £99 plan prices, the billing portal and the webhook in Stripe
   - sets the function secrets and deploys every Edge Function
   - schedules the daily auto-release
   - writes `.env` so the app uses the real back end

   It's safe to re-run. Generated secrets go in `.env.local`, which is never committed.
3. Three steps it can't do for you (it prints them at the end):
   - turn on Stripe Connect (Express accounts, United Kingdom)
   - add your own email sender (SMTP) in Supabase
   - make yourself an admin

## Testing the database rules

`supabase/tests/rules.test.sql` runs as real users through RLS (30 checks). It covers:
- the `.ac.uk` sign-up and the £12.71/hour minimum
- fees on hire (£450 → £504), and that only Stripe can mark payments or features as paid
- 7-day auto-release, and asking for changes pausing it
- cancelling hires and projects, and withdrawals
- blind reviews and admin-only metrics

`run.sh` creates a throwaway database, applies the migrations on a small Supabase stand-in, and runs the checks:

```bash
PGHOST=... PGPORT=... PGUSER=postgres supabase/tests/run.sh
```

The Deno tests in `supabase/functions/_shared/` cover webhook signature checks. They also check that a retried Stripe
event is never refunded, while payment for a hire that was cancelled during checkout is (`deno test`).

## Not built yet

- Referrals, university outcomes dashboard, Android
- Right-to-work / visa flows: deliberately not built until legal advice is in (`right_to_work_status` is stored)
