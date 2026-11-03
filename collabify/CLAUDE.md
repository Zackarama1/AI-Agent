# Collabify — iOS app (Expo)

Collabify is a UK marketplace connecting university-verified students with startups for short, paid, remote projects. Students pay nothing and keep 100% of the project fee; businesses pay a service fee on each payment. This repo is the iOS-first app (Android later from the same code).

Read `AGENTS.md` too: Expo changes every SDK — check versioned docs before using any Expo API. This project is on **Expo SDK 58** (React Native 0.88, React 19.3, TypeScript 6). Always add packages with `npx expo install`.

## Current state

- Scaffolded from `blank-typescript`; entry is `expo-router/entry`; routes go in `src/app/`; `@/*` maps to `src/*`.
- Installed: expo-document-picker, expo-router, expo-font, @expo-google-fonts/inter, expo-haptics, expo-linear-gradient, expo-secure-store, expo-web-browser, @expo/vector-icons, @supabase/supabase-js, @react-native-async-storage/async-storage, react-native-url-polyfill, react-native-web, react-dom.
- Build plan steps 1–8 are implemented for the MVP: all screens (demo mode), Supabase migration with RLS and tests (`supabase/tests/rules.test.sql`), Supabase `Api`, Edge Functions (Stripe Connect, write-brief; typechecked with Deno but not yet run against real Stripe or a hosted Supabase project), admin hand-matching and metrics. See README.md for setup and what's not built yet.
- Also built: ask for changes, cancel hire/project, withdraw, dispute resolution (`resolve-dispute`), featured listings and plans via Stripe Checkout (`billing-checkout`). Tests: `npm test` (Jest), `supabase/tests/run.sh` (SQL/RLS), `deno test` in `supabase/functions`.
- Launch readiness: Stripe pages return to the app via `stripe-return` (collabify:// deep link), in-app account deletion (`delete-account`, blocked while payment is held), and `npm run go-live` (sets up Supabase + Stripe test mode from two keys; written against the Supabase CLI 2.121.0 help but not yet run, because this environment's network blocks Supabase and Stripe).
- Notifications: DB triggers fill `notifications` (mirrored in the demo store); activity feed + bell; push via expo-notifications → `send-push` (Expo push API), turned on by go-live. Push needs `eas init` for the project id. New tables must revoke Supabase's default grants (a SQL guard test enforces this).
- Invites: `project_invites` (RLS + notify trigger); business project page suggests top matches to invite. Preview: `scripts/build-preview.mjs` (PREVIEW_BUILD=1 via app.config.js turns off async routes so the web export inlines into one HTML file).
- UX layer: `components/motion.tsx` (spring press, fade-in, skeletons; RN Animated with native driver, respects Reduce Motion) and `components/feedback.tsx` (toasts, celebrations via `useFeedback()`). Contract screens are driven by `lib/contractFlow.ts` (pure, tested): add new lifecycle rules there, not in screens. Companies have industry/size/location/about plus `business_stats` (computed, never self-reported); projects have deliverables, level, work_mode/city, validated by `lib/projectRules.ts` (mirrors the DB checks).
- Not yet run on a physical device or the iOS simulator; verified with tsc, expo lint, tests, and a web export click-through.
- Expo Router 58 import paths: `Stack` from `expo-router/stack`, `Tabs` from `expo-router/js-tabs` (the root `Tabs` export is deprecated). Check `node_modules/expo-router/package.json` exports before importing anything else.

## Product rules (do not change without asking Zack)

- Fees are charged to the business on top of the project price: Free plan 12%, Startup Pro 8% (£29/month), Scale 5% (£99/month). Featured listing £19.
  Example: £450 project on Free → business pays £504, student gets £450, Collabify earns £54 (≈ £43 after Stripe).
- Students never pay and keep 100%.
- Minimum effective rate: every project has estimated hours, and budget ≥ hours × £12.71. Enforce in the UI and in the database.
- Students must sign up with a UK university email (domain ending `.ac.uk`).
- Payment flow: business funds up front → money is held → released to the student on approval, or automatically 7 days after delivery.
- Reviews are blind: neither side sees the other's review until both have submitted.
- Never call it "escrow" in the UI; say "payment held" or "protected".
- Open legal question: Student-visa holders generally can't be self-employed. Don't build visa-specific flows until legal advice is in; keep a `right_to_work_status` field so it can be added.

## Stack

- App: Expo + Expo Router, TypeScript strict.
- Back end: Supabase (Postgres, Auth with email one-time code, Storage for deliveries, Edge Functions).
- Payments: Stripe Connect, Express accounts (country GB), "separate charges and transfers". Business pays via Stripe Checkout opened with `expo-web-browser` (no in-app purchase: these are real-world services). On release, create a Transfer to the student's connected account with `source_transaction` set to the charge, so it works before funds settle.
- AI brief writer: a Supabase Edge Function calling the Claude API; template fallback when no key is set.
- Config via `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Stripe secret and Claude API keys live only in Edge Function secrets, never in the app.
- **Demo mode**: when Supabase env vars are missing, the app runs on an in-memory store with seeded, clearly fictional businesses and projects, so every screen can be clicked through. Put a single `Api` interface in `src/lib/api.ts` with two implementations (demo, Supabase).

## Design

Apple-keynote feel: huge bold headlines, lots of white space, rounded cards, very little text.
- Purple `#5B3DF5` (primary), near-black `#1D1D1F`, light grey `#F5F5F7`, white `#FBFBFD`, green `#34C759` for money (use `#248A3D` for green text on light backgrounds).
- Inter (400/600/700/800), tight letter-spacing on headlines.
- Haptics on key actions (apply, hire, fund, approve), light sounds later.
- Support dark mode.

## Data model (Supabase, with RLS on every table)

- `profiles` (id = auth user, role: student | business | admin, full_name)
- `students` (public: university, course, year, skills[], bio, portfolio_url) and `student_private` (university_email, stripe_account_id, payouts_enabled, right_to_work_status, verified_at)
- `businesses` (company_name, website, plan: free | pro | scale)
- `projects` (business_id, title, category, brief, budget_pence, estimated_hours, duration_days, skills[], status: open | in_progress | delivered | completed | cancelled; check budget_pence >= estimated_hours * 1271)
- `applications` (project_id, student_id, pitch, status: applied | shortlisted | hired | declined; unique per project+student)
- `contracts` (project_id unique, business_id, student_id, amount_pence, fee_rate, fee_pence, total_pence, status: awaiting_funding | funded | delivered | released | refunded | disputed, Stripe ids, funded_at, delivered_at, released_at, auto_release_at)
- `deliveries` (contract_id, message, file_paths[])
- `reviews` (contract_id, reviewer_id, reviewee_id, rating 1–5, comment; blind visibility via policy)
- `messages` (contract_id, sender_id, body)
- Hiring goes through a security-definer function `hire_student(application_id)` that creates the contract with the right fee for the business's plan. Contract status changes from Stripe happen only in Edge Functions using the service role.

## Edge Functions

- `connect-onboarding`: create or reuse the student's Express account, return an account link.
- `fund-contract`: create a Checkout Session for `total_pence` with contract metadata; return its URL.
- `stripe-webhook`: on checkout completed → contract `funded`, store payment intent and charge ids; on account updated → `payouts_enabled`.
- `release-payment`: business approves a `delivered` contract → Transfer `amount_pence` to the student → `released`, project `completed`.
- `auto-release`: scheduled daily; releases contracts delivered more than 7 days ago.
- `write-brief`: turns a rough idea into a structured brief.

## Build plan (MVP for the first 20–30 hand-matched projects)

1. Theme, fonts, UI components; demo store with seed data.
2. Welcome (choose Student or Business) → sign-in with email code (students: `.ac.uk` check).
3. Student tabs: Projects feed, project detail + apply, My work (deliver files), Profile (Stripe payouts setup).
4. Business tabs: My projects (applicants, hire, fund, approve), Post a project (templates + AI brief, live fee preview), Profile (plan).
5. Supabase migration with RLS, then the Supabase `Api` implementation.
6. Edge Functions and Stripe in test mode.
7. Admin view for hand-matching (can start as a simple screen for `role = admin`).
8. Metrics: fill rate, time to match, repeat clients.
Later: subscriptions (Stripe Billing, sold on the web), referrals (£10 each side), smart matching, university outcomes dashboard, Android.

## Before declaring anything done

`npx tsc --noEmit`, `npx expo lint`, and run it in the iOS simulator or Expo Go.
