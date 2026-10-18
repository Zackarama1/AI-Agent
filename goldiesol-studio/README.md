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
(`src/lib/seed`), sign-in is skipped and a banner says so. In demo mode new designs, versions and shapes live in
server memory only and disappear when the server restarts.

### Editor shortcuts

| Keys | Action |
|---|---|
| ⌘/Ctrl Z · ⇧⌘/Ctrl Z (or Ctrl Y) | Undo · redo |
| ⌘/Ctrl D | Duplicate the selected detail |
| Delete / Backspace | Remove the selected detail |
| + · − · 0 | Zoom in · out · reset |
| Esc | Deselect, or cancel pin placement |

### Connect Supabase

1. Create a Supabase project (the `vector` extension is available by default).
2. Apply the schema: `supabase db push`, or paste `supabase/migrations/0001_foundation.sql` into the SQL editor.
3. Load the seed: paste `supabase/seed.sql` into the SQL editor (locally, `supabase db reset` runs it automatically).
4. In **Authentication → URL configuration**, add `http://localhost:3000/auth/callback` (and your Vercel URL) as redirect URLs.
5. Fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` and restart.
6. Sign in with your email (magic link). **The first person to sign in becomes owner of the Goldiesol team.**
   Everyone after that needs a row in `team_invites` first; otherwise they can sign in but see nothing.

Apply every file in `supabase/migrations/` in order (`0002_editor.sql` adds the shape-usage counter).

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
src/lib/garment/         Parametric garment engine: templates/, textures/, render.ts (SVG), grading.ts, schema.ts
src/components/editor/   Design editor (Zustand store, canvas, left rail, right panel)
src/components/brand/    Wordmark, lace watermark, empty states, status pills
src/components/shell/    Sidebar, mobile nav, theme toggle
src/app/(studio)/        Studio routes (§3)
src/app/(editor)/        Full-screen editor at /designs/[id]
src/app/actions/         Server actions (validated with zod)
```

## Build status

| Phase | Status |
|---|---|
| 1. Foundation: Next.js, Supabase + auth, theme, shell, routes, migrations, seed | ✅ Done |
| 2. Garment engine + Editor: parametric templates, fabrics/lace/prints, embellishments, hardware, views, autosave versions, Shape Library | ✅ Done |
| 3. Library & Notes: filters, grid/list/board views, compare, duplicate/branch, collections, pinned notes, version restore | ✅ Done |
| 4. AI Partner | Next |
| 5. Insights | — |
| 6. Model Mode | — |
| 7. Tech Pack | — |
| 8. Supplier CRM | — |
| 9. Polish | — |
