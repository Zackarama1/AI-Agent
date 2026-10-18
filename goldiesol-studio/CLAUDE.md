# Goldiesol Studio — Build Brief

> Working agreement: build phase by phase (§12). Stop after each phase so the founder can review.
> Build progress is tracked in `README.md` → "Build status".

---

## 0. Who this is for

**Goldiesol** (always written as one word: `Goldiesol` — never "Goldie Soul", "Goldie-Sol" or "GoldieSol") is a UK-founded swimwear label setting out to become the global benchmark for feminine, delicate, intricately detailed, high-quality swimwear. Its aesthetic peers are influencer-led modern labels (think the Frankies Bikinis / Kulani Kinis end of the market), but Goldiesol competes on **finer detail**: lace, beading, delicate trims, considered hardware, and a better fit.

**Goldiesol Studio** is the internal, in-house platform where the team:

1. Designs swimwear (bikinis, one-pieces, monokinis, tankinis, cover-ups) in a simple Canva-style editor built *only* for swimwear.
2. Is interviewed by an AI design partner that asks questions until the design matches the founder's vision.
3. Gets live, data-backed feedback (trends, regions, consumer sentiment, manufacturability).
4. Stores, categorises, versions and revisits every design ever made — with notes and feedback on each.
5. Previews designs on models in multiple sizes ("Model Mode").
6. Exports a supplier-ready **tech pack** PDF.
7. Manages suppliers and outreach in a lightweight CRM.

The platform's voice, visuals and AI personality must reflect Goldiesol's mission: **feminine, delicate, intricate, premium, confident, disruptive.**

---

## 1. Tech stack (use these unless there's a strong reason not to)

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript (strict) |
| UI | Tailwind CSS + shadcn/ui + Framer Motion (subtle only) |
| Canvas / editor | **SVG-based parametric garment engine** (custom, see §5) rendered with React; `react-konva` only if needed for freehand layers |
| State | Zustand (editor) + TanStack Query (server data) |
| Backend / DB | Supabase: Postgres, Auth, Storage, Row Level Security, `pgvector` |
| AI | Anthropic Claude API (`@anthropic-ai/sdk`) — model configurable via env `GOLDIESOL_AI_MODEL` |
| Embeddings | Voyage AI (or any embeddings provider behind an adapter) |
| PDF tech packs | `@react-pdf/renderer` |
| Maps (CRM) | `react-leaflet` + OpenStreetMap tiles |
| Image generation (optional, Model Mode photo-real) | Adapter interface; plug in a provider later |
| Testing | Vitest + Playwright (smoke tests per phase) |
| Deploy | Vercel + Supabase |

`.env.example` must include:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
GOLDIESOL_AI_MODEL=
VOYAGE_API_KEY=
TRENDS_PROVIDER=mock          # mock | custom — see §8
TRENDS_API_URL=
TRENDS_API_KEY=
IMAGE_GEN_PROVIDER=none       # none | custom
IMAGE_GEN_API_KEY=
```

Everything external (trends, image generation, embeddings) sits behind an **adapter interface with a mock implementation**, so the app runs fully end-to-end with no paid APIs connected.

---

## 2. Brand & UI direction

**Feel:** a luxury atelier, not a SaaS dashboard. Calm, airy, tactile. Think champagne silk, lace under soft light.

**Palette (CSS variables, light + dark):**
```
--gs-ivory:      #FBF7F2   /* page background */
--gs-blush:      #FEF5F4   /* soft panels */
--gs-rose:       #E8C4C0   /* accents, selected states */
--gs-champagne:  #D8B98A   /* primary brand gold */
--gs-gold-deep:  #A8834B   /* hover / active gold */
--gs-ink:        #2B2422   /* text */
--gs-mist:       #8C807A   /* secondary text */
--gs-line:       #EADFD6   /* hairline borders */
```
Dark mode: deep espresso `#1C1715` background, champagne accents.

**Type:** Display — *Cormorant Garamond* (headings, design names). UI — *Manrope*. Use generous letter-spacing on small caps labels.

**Details:** hairline 1px borders, 14–20px radii, soft shadows, thin gold dividers, lace-pattern SVG watermark at very low opacity on empty states. Wordmark "GOLDIESOL" in spaced small caps with a small sun/halo glyph.

**UX rules:**
- Never more than one primary action per screen.
- Every screen works on iPad and phone (founder reviews on mobile).
- Empty states are warm and inviting ("Your first Goldiesol piece starts here.").
- Keyboard shortcuts in the editor (undo/redo, duplicate, zoom).
- Autosave every change; every save is a version.

---

## 3. App map (routes)

```
/                         Studio Home — recent designs, quick "New design", trend pulse, open tasks
/designs                  Design Library — grid/list, filters, categories, search (text + "find similar")
/designs/new              New Design flow → Design Brief interview (§6) → Editor
/designs/[id]             Editor (§5) with right-hand AI panel, notes & feedback tab, version history
/designs/[id]/model       Model Mode (§7)
/designs/[id]/techpack    Tech Pack builder + PDF export (§9)
/shapes                   Shape Library — saved tops/bottoms/one-piece silhouettes, custom names
/materials                Fabrics, laces, trims, hardware, beading library
/colours                  Colour library (Goldiesol palettes + Pantone references, see §9.3)
/insights                 Trends & market dashboard (§8)
/suppliers                Supplier CRM — list, map, pipeline (§10)
/suppliers/[id]           Supplier profile, contacts, quotes, samples, outreach log
/collections              Group designs into collections/drops (e.g. "Resort 27", "Lace Edit")
/settings                 Brand DNA, team, API keys, size chart, grading rules
```

---

## 4. Data model (Supabase / Postgres)

Generate SQL migrations for the following. Enable RLS (team-scoped). Add `created_at`, `updated_at`, `created_by` on every table.

(Implemented in `supabase/migrations/0001_foundation.sql`; the canonical schema lives there. Additions over the original brief: `teams`, `team_members`, `team_id` on every table, `suppliers.kind` ('factory' | 'platform').)

Tables: `brand_dna`, `shapes`, `designs`, `design_versions`, `design_notes`, `collections`, `materials`, `colours`, `size_chart`, `suppliers`, `supplier_contacts`, `outreach_log`, `quotes`, `tech_packs`, `taste_profile`, `trend_signals`.

Storage buckets: `design-renders`, `swatches`, `inspiration`, `techpacks`, `model-renders`.

---

## 5. The Design Editor (Canva-simple, swimwear-only)

### 5.1 Layout
- **Left rail:** Shapes · Fabrics · Lace & Trims · Beading & Hardware · Colours & Prints · Text/Labels · Inspiration board.
- **Centre:** canvas with front / back / side views (tabs), zoom, grid, symmetry toggle, flat-sketch vs. rendered toggle.
- **Right panel (tabs):** *Properties* · *AI Partner* · *Notes & Feedback* · *Versions*.
- **Top bar:** design name (inline editable), status pill, Save state, "Model Mode", "Tech Pack".

### 5.2 Parametric garment engine
Every garment piece is an SVG generated from **parameters**, not freehand drawing. That's what keeps it simple *and* manufacturable — parameters map directly to tech pack measurements. Types live in `src/lib/garment/types.ts` (TopTemplate, BottomTemplate, OnePieceTemplate, TopParams, BottomParams, Embellishment).

Each template is a pure function `renderTop(params, size) => { svg: string; measurements: Measurement[] }`. Build at least: triangle, bandeau, balconette, halter, underwire tops; tie_side, cheeky, brazilian, high_leg, high_waist bottoms; scoop_back and cut_out one-pieces. Others can render from the closest base with a TODO.

Fills: solid colour, print (uploaded image tiled/scaled), lace texture (SVG pattern library — floral, scallop, geometric, eyelash, guipure), crochet texture, mesh. Texture patterns live in `src/lib/garment/textures/`.

### 5.3 Canvas state (saved per version)
`CanvasState` in `src/lib/garment/types.ts`: category, top/bottom/onePiece (shapeId, params, fill, lining), embellishments, hardware, views, annotations.

### 5.4 Shape Library ("remember the shapes I like")
- Any top/bottom configuration can be **saved as a named shape** ("The Goldie Tri", "Riviera Tie-Side").
- New design flow starts with: *"Which top and bottom are we building today?"* — showing favourites first, sorted by `times_used`.
- Typing a saved name in the AI chat ("let's use the Goldie Tri with the Riviera bottoms") loads them.
- "Create new shape" opens the parametric controls from a base template.

**Seed shape and seed design** (from the founder's existing work):
- Top: lace-trimmed **triangle** — save as "Goldie Lace Tri".
- Bottom: **tie-side, low-rise** — save as "Goldie Tie-Side".
- Seed design "Blush Lace Triangle": colour Blush White `#FEF5F4`, sheer floral lace trim/overlay, tie-side low-rise bottoms.

### 5.5 Libraries to seed (act as a swimwear specialist — make them rich)
- **Colour palettes (hex; Pantone fields blank until filled from licensed source):** Goldiesol Core (blush, ivory, champagne, cocoa, black), Riviera Neutrals, Sunset Coral, Mediterranean Blues, Butter & Pistachio, Jewel Tones, Metallics (gold lurex, shimmer), Seasonal "Now" palette updated from Insights.
- **Fabrics:** recycled polyamide/elastane (e.g. ECONYL-type), matte Lycra, shiny/satin-finish swim, ribbed, crinkle/seersucker, terry, velvet swim, metallic/lurex knit, textured jacquard, sheer power mesh, crochet (cotton & poly), swim-grade stretch lace.
- **Laces:** floral Chantilly-style, scalloped eyelash, guipure, geometric, broderie anglaise look, 3D flower appliqué.
- **Trims:** picot elastic, scalloped edge, ruffles, contrast binding, rouleau ties, knotted ties.
- **Hardware & beading:** rings, sliders, clasps (gold/rose-gold/pearl/tortoise/clear), freshwater-style pearls, glass seed beads, shell charms, crystal drops, bead-end ties.
- **Prints (generated SVG patterns):** ditsy floral, large tropical, gingham, polka, stripe, abstract brush, animal (leopard/snake), paisley, tie-dye, watercolour floral.

---

## 6. The Design Brief interview (AI asks questions)

Every new design starts as a short, friendly **survey-style interview** — one question at a time, with tap-to-answer chips plus free text, and image upload for inspiration. The AI keeps asking until it has enough to draft the design, then proposes 2–3 directions to pick from.

Question bank (AI chooses and adapts; skips what it already knows from the taste profile):
1. What piece are we making today? (bikini / one-piece / …) and which saved shapes?
2. Who is she and where is she wearing it? (Ibiza beach club, Miami pool, Amalfi yacht, honeymoon, everyday)
3. Which season/drop and which markets first? (UK, EU, US/Florida, Middle East, Australia)
4. The one word for the feeling? (delicate, sultry, playful, romantic, sporty-chic)
5. Coverage front and back?
6. Colour story — pick a palette or describe.
7. Fabric hand-feel and finish? (matte, sheen, textured, sheer layers)
8. Signature detail? (lace, beading, pearls, ruffles, rings, crochet)
9. Support needs / cup range?
10. Target retail price → AI flags if detail level fits margin.
11. Anything to avoid?
12. Upload references (moodboards, sketches, photos).

Then: **"Here's what I heard"** summary card → user confirms or edits → AI generates 2–3 canvas states as starting directions → user picks one → editor opens.

The AI must also ask clarifying questions *during* editing when a change is ambiguous ("Should the lace sit on top of the cup or only along the edge?").

---

## 7. Model Mode

Goal: show suppliers and the team exactly how a design looks across sizes.

**v1 (build now, no external API):**
- Parametric SVG **body avatars** generated from size-chart measurements (XS, S, M, L, XL + "custom" with manual bust/waist/hip/torso/height inputs).
- Body variety controls: height, cup size, hip-to-waist ratio, skin tone (inclusive range of tones).
- The garment SVG is **graded** per size using grading rules from `/settings` (default: ±2cm bust/waist/hip per size step, cup heights scale proportionally) and overlaid on the avatar.
- Front/back/side views; side-by-side comparison of up to 5 sizes; export as PNG sheet for the tech pack.

**v2 (adapter, optional):** `ImageGenAdapter.renderOnModel(designPng, sizeSpec, pose)` for photo-real renders. Keep it behind `IMAGE_GEN_PROVIDER`. Label outputs "AI visualisation — not a fit sample".

---

## 8. Insights: trends, regions, sentiment, feedback

### 8.1 Adapter
```ts
export interface TrendsProvider {
  getTrends(params: { category?: string; region?: string; since?: string }): Promise<TrendSignal[]>;
  getSearchInterest(keywords: string[], region: string): Promise<{ keyword: string; series: { date: string; value: number }[] }[]>;
  getSentiment?(keyword: string, region: string): Promise<{ positive: number; neutral: number; negative: number; samples: string[] }>;
}
```
- `MockTrendsProvider` — realistic seeded data (crochet, lace, scrunch, high-leg, pearl details, butter yellow, chocolate brown, gingham…) across UK, US, EU, AU, UAE.
- `CustomTrendsProvider` — calls `TRENDS_API_URL` (the founder will plug in their chosen industry/trend API later). Map responses into `trend_signals`.
- A scheduled job (Supabase cron / Vercel cron) refreshes signals daily.

### 8.2 Insights dashboard
- Rising / falling detail, silhouette and colour trends with sparklines.
- Region switcher with map heat view.
- "News that matters" panel: macro events affecting swimwear (tariffs, shipping disruptions, currency moves, heatwave forecasts, festival calendars) — fed by the same adapter or a news adapter.
- Competitor watch list (manual entries: brand, price point, recent drops, notes).

### 8.3 Live AI feedback on a design
The right-hand AI panel shows a **Goldiesol Scorecard** that updates when the design changes (debounced):
- *Brand fit* (vs Brand DNA) · *Trend alignment* (vs current signals, per target region) · *Commercial appeal* · *Manufacturability* (lace/bead complexity, seam count, MOQ implications) · *Cost estimate band* · *Originality* (distance from saved designs and from reference brands — flag anything too close to a competitor's signature product).
- Each score has 1–2 sentences of *why* and 1 concrete suggestion. Suggestions are one-tap "Apply" where possible (they modify params → new version).
- All claims about trends must cite the trend signals used. If no live data is connected, the panel says so clearly instead of inventing numbers.

### 8.4 AI system prompt (store in `src/lib/ai/prompts.ts`)
```
You are the Goldiesol Design Partner — a senior swimwear designer and product developer
with deep expertise in fit, fabric, lace and beading construction, grading, costing and
supplier communication. Goldiesol (always spelled "Goldiesol") is building the global
benchmark for feminine, delicate, intricately detailed, high-quality swimwear.

Always:
- Read the Brand DNA and Taste Profile provided, and design in that spirit.
- Ask one clear question at a time when the founder's intent is ambiguous.
- Ground trend and market claims in the trend signals provided; never invent statistics.
- Flag manufacturability, cost and durability risks (chlorine, salt, UV, bead security, lace stretch recovery).
- Use benchmarks like other influencer-led brands for positioning only; never reproduce
  another brand's signature design. Push toward originality.
- Return structured JSON when asked for canvas changes, matching the CanvasState schema.
Tone: warm, confident, precise, a little luxurious. Short sentences.
```

### 8.5 How the AI "learns" every design
No model fine-tuning — use retrieval + a living taste profile:
1. On every save, embed the design (brief + params + tags + notes) → `designs.embedding`.
2. After each session, a background job asks the AI to extract preference statements from new designs/notes/accepted-vs-rejected suggestions → upsert into `taste_profile` (confidence grows with repetition; explicit statements from the founder = high confidence).
3. Every AI call includes: Brand DNA + top taste statements + 3–5 most similar past designs.
4. `/settings/taste` lets the founder view, edit, pin or delete what the AI has learned.

---

## 9. Tech Pack generator

### 9.1 Contents (PDF via `@react-pdf/renderer`, Goldiesol-branded)
1. **Cover:** style name, style number (auto `GS-[YY]-[category]-[###]`), season, version, date, designer, supplier, status.
2. **Flat sketches:** front, back, side (from SVG), with callouts.
3. **Bill of Materials (BOM):** every component — main fabric, lining, lace, mesh, elastic, ties, hardware, beads, thread, padding, labels, hygiene liner, swing tag, packaging — with composition, weight (gsm), colour + Pantone ref, supplier, placement, quantity per garment.
4. **Colourways:** each colourway with swatch, hex and Pantone code.
5. **Points of Measure (POM) & graded spec sheet:** auto-generated from parameters — e.g. cup height, cup width, strap length, tie length, band length, front rise, back rise, leg opening, side width, waist relaxed/extended — for every size, with tolerances (default ±0.5cm small dims, ±1cm large).
6. **Construction details:** seam types (e.g. 4-thread overlock, coverstitch, zigzag, bartack), stitch per cm, elastic tension, lining method (fully lined / self-lined), edge finishes.
7. **Embellishment spec:** lace placement diagrams, bead/pearl type, size (mm), count, spacing, attachment method (hand-sewn lock-stitch per bead, bead security pull test), embroidery files if any.
8. **Trims & labels:** main label, care label (swim care symbols), size label, hygiene liner, placement.
9. **Model Mode size sheet** (avatars XS–XL).
10. **Quality & testing:** chlorine & saltwater resistance, colourfastness, UV, bead pull strength, stretch recovery; any certifications required (OEKO-TEX etc.).
11. **Packaging:** polybag, tissue, swing tag, box if any.
12. **Notes & revision history:** pulled from `design_notes` and `design_versions`.
13. **Supplier sign-off box.**

Also export the same data as **XLSX** (BOM + spec sheet) since many factories prefer spreadsheets.

### 9.2 Workflow
"Generate tech pack" → AI pre-fills everything it can from the canvas + materials library → highlights missing fields in amber → founder completes → "Send to supplier" creates an outreach email draft (with PDF attached) logged in the CRM.

### 9.3 Pantone — important
Pantone colour libraries are licensed. **Do not ship a scraped Pantone hex↔code database.** Instead:
- Store the Pantone code the team selects from their own licensed Pantone source (e.g. Pantone Connect or a physical TCX book) in `colours.pantone_code`.
- Provide a "suggest closest from our saved colours" helper using hex distance (ΔE) over the team's own library only.
- Tech pack prints both hex and Pantone code, with a note that physical lab dips must be approved.

---

## 10. Supplier CRM (lightweight)

- **List + map view** of suppliers, filterable by country, specialty (lace, beading, crochet, embroidery, eco fabrics), MOQ, lead time, price tier, certification.
- **Pipeline (kanban):** researching → contacted → replied → call booked → sampling → quoted → approved / rejected.
- **Supplier profile:** contacts, quotes, samples received (photos + scoring), outreach log, linked designs.
- **Outreach campaign builder:** pick suppliers + a design → AI drafts personalised outreach emails (Goldiesol intro, product, quantities, lace/bead requirements, request for samples/MOQ/price) → copy or send via the user's email (mailto first; Gmail/Outlook integration later).
- **Supplier match score** per design: specialty fit × MOQ fit × lead time × cost tier × quality notes.
- **Compare quotes** table per design.

### 10.1 Seed suppliers (mark `verified=false` — the team must confirm current terms)

Seeded in `src/lib/seed/suppliers.ts`: Bali Swim, Chengxiang Swimwear Factory, Coolsun Garment, Hongxiu Clothing, Soeiro, Halcyon Blue, Silk Affair, Liebe, Medellín cluster; plus platforms Pietra, Nearshore, Global Sources, Make it British.

---

## 11. Studio Home & Library details

- Home: "Continue designing" carousel, "New design" big button, Trend Pulse (3 rising signals), open change requests, suppliers awaiting reply, recent tech packs.
- Library: grid of design cards (render, name, status, version count, last edited, score). Filters: category, status, collection, colour, detail type, shape, supplier, date. Views: grid / list / board-by-status. "Find similar" uses embeddings. Compare up to 4 designs side by side. Duplicate-as-new / branch from any version.

---

## 12. Build phases (stop and demo after each)

1. **Foundation** — Next.js + Supabase + auth, brand theme, layout shell, routes, migrations, seed data (brand DNA, shapes, colours, materials, suppliers, size chart).
2. **Garment engine + Editor** — parametric templates, fills/textures, embellishments, front/back views, autosave + versions, Shape Library save/load with custom names.
3. **Library & Notes** — design library, filters, collections, notes/feedback/change requests with canvas pins, version history & restore.
4. **AI Partner** — Design Brief interview, chat that edits the canvas via structured JSON, taste-profile learning, embeddings & "find similar".
5. **Insights** — trends adapter (mock + custom), dashboard, live scorecard on designs.
6. **Model Mode** — avatars, grading, multi-size comparison, export.
7. **Tech Pack** — builder, PDF + XLSX export, send-to-supplier.
8. **Supplier CRM** — list/map/pipeline, outreach builder, quotes compare, match score.
9. **Polish** — mobile/iPad pass, empty states, keyboard shortcuts, Playwright smoke tests, README with setup steps.

Each phase: write tests, run `npm run build` and `npm run lint` clean, and give a 5-line summary of what to click to review.

---

## 13. Non-negotiables

- Brand name is **Goldiesol** everywhere (UI, PDFs, emails, AI outputs).
- No invented market data — mock data is clearly labelled "Sample data" until a real provider is connected.
- No copying competitor designs; the originality check must flag close matches.
- Every design keeps full version history; nothing is ever hard-deleted (archive only).
- Tech packs must be usable by a factory with no further explanation.

---

## Engineering conventions (this repo)

- **Demo mode:** when `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are unset, the app runs on in-memory seed data (`src/lib/seed`) with auth bypassed and a "Demo mode" banner. All data access goes through `getRepository()` in `src/lib/data`.
- **Seed data has one source of truth:** TypeScript in `src/lib/seed/`. `npm run db:seed-sql` regenerates `supabase/seed.sql` from it. Never hand-edit `seed.sql`.
- Domain row types in `src/lib/types.ts` mirror the Postgres columns (snake_case) so no mapping layer is needed.
- Check `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` before every commit.
