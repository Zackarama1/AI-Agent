# Goldiesol Studio

The in-house design atelier for **Goldiesol**: design swimwear, get AI and market feedback, preview pieces across
sizes, export supplier-ready tech packs and manage suppliers. The full product brief lives in [`CLAUDE.md`](./CLAUDE.md).

## Run it

```bash
cd goldiesol-studio
npm install
cp .env.example .env.local   # optional — leave empty for demo mode
npm run dev                  # http://localhost:3000
```

With no Supabase keys the studio runs in **demo mode**: everything renders from the Goldiesol seed data
(`src/lib/seed`), sign-in is skipped and a banner says so.

### Connect Supabase

1. Create a Supabase project (the `vector` extension is available by default).
2. Apply the schema: `supabase db push`, or paste `supabase/migrations/0001_foundation.sql` into the SQL editor.
3. Load the seed: paste `supabase/seed.sql` into the SQL editor (locally, `supabase db reset` runs it automatically).
4. In **Authentication → URL configuration**, add `http://localhost:3000/auth/callback` (and your Vercel URL) as redirect URLs.
5. Fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` and restart.
6. Sign in with your email (magic link). **The first person to sign in becomes owner of the Goldiesol team.**
   Everyone after that needs a row in `team_invites` first; otherwise they can sign in but see nothing.

Row Level Security scopes every table to team members. Designs, versions, notes, tech packs, collections and the
outreach log have no delete policy, so they can only be archived.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Vitest, including running the migration + seed against in-process Postgres (PGlite) to check RLS |
| `npm run test:e2e` | Playwright smoke tests (desktop + phone) against a production build; run `npm run build` first |
| `npm run db:seed-sql` | Regenerate `supabase/seed.sql` from `src/lib/seed` (never edit `seed.sql` by hand) |

## Layout

```
supabase/migrations/     Postgres schema, RLS, storage buckets
supabase/seed.sql        Generated seed (brand DNA, shapes, colours, materials, suppliers, size chart, seed design)
src/lib/seed/            Seed data — the single source of truth
src/lib/data/            Repository interface; demo (seed) and Supabase implementations
src/lib/garment/types.ts Parametric garment + canvas types (§5)
src/components/brand/    Wordmark, lace watermark, empty states, status pills
src/components/shell/    Sidebar, mobile nav, theme toggle
src/app/(studio)/        All studio routes (§3)
```

## Build status

| Phase | Status |
|---|---|
| 1. Foundation: Next.js, Supabase + auth, theme, shell, routes, migrations, seed | ✅ Done |
| 2. Garment engine + Editor | Next |
| 3. Library & Notes | — |
| 4. AI Partner | — |
| 5. Insights | — |
| 6. Model Mode | — |
| 7. Tech Pack | — |
| 8. Supplier CRM | — |
| 9. Polish | — |
