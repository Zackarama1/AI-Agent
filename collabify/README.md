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
| Featured listings (£19, 7 days) and Startup Pro / Scale plans, sold through Stripe Checkout in the browser | `project/[id].tsx`, `plans.tsx`, `billing-checkout` |
| Admin hand-matching + metrics (fill rate, time to match, repeat clients) | `src/app/admin.tsx` |
| One `Api` interface, two implementations | `src/lib/api.ts`, `src/lib/demo/store.ts`, `src/lib/supabase/api.ts` |
| Fees and rules | `src/lib/fees.ts` (12% / 8% / 5% on top, students keep 100%) |
| Database, RLS, hiring/delivery/review functions | `supabase/migrations/` |
| Stripe Connect + AI brief writer | `supabase/functions/` |

## Go live with Supabase

1. Create a Supabase project, then link and push the schema:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
2. **Auth → Email templates → Magic Link**: show the code with `{{ .Token }}` (the app signs in with a 6-digit code, not a link).
3. Set the function secrets and deploy:
   ```bash
   npx supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_... \
     STRIPE_PRICE_PRO=price_... STRIPE_PRICE_SCALE=price_... \
     APP_RETURN_URL=collabify://student/profile CRON_SECRET=<random> ANTHROPIC_API_KEY=<optional>
   npx supabase functions deploy
   ```
   Without `ANTHROPIC_API_KEY`, the brief writer uses the built-in template.
4. In Stripe (test mode):
   - Enable Connect with Express accounts.
   - Create two monthly prices, £29 (Startup Pro) and £99 (Scale), and use their ids for `STRIPE_PRICE_PRO` and `STRIPE_PRICE_SCALE`.
   - Turn on the customer billing portal, so subscribers can switch plans or cancel.
   - Add a webhook to `https://<ref>.functions.supabase.co/stripe-webhook` for `checkout.session.completed`,
     `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` and `account.updated`.
5. Schedule auto-release daily (SQL editor, with `pg_cron` and `pg_net` enabled):
   ```sql
   select cron.schedule('auto-release', '17 3 * * *', $$
     select net.http_post('https://<ref>.functions.supabase.co/auto-release',
       headers => '{"x-cron-secret": "<CRON_SECRET>"}'::jsonb)
   $$);
   ```
6. Put `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env` and restart Expo.

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
