# QUARRY — Plan (Phase 0 + Phase 1)

Status: **DRAFT, awaiting Zack's approval.** No code until approved.
Date: 2026-10-18. Figures marked † come from the master prompt and third-party
trackers. Each is re-checked against vendor docs before its adapter is built,
and any difference is logged in `docs/PROVIDERS.md`.

---

## 0. Placement decision (needs an answer)

This repository (`AI-Agent`) currently contains an unrelated **booking-agent
PoC** (`agent.py`, `browser_tools.py`, `tasks/`). QUARRY is a large,
long-lived product with its own CI, docker-compose and CLAUDE.md, so it should
not share a root with the PoC.

| Option | Pros | Cons |
|---|---|---|
| **A. New repo `quarry` (recommended)** | Clean CI, history, CLAUDE.md and licence | You create the repo; I can't create repos from this session without it being added |
| B. `quarry/` subdirectory here | Works today | CI and tooling must be path-scoped; muddled history; root CLAUDE.md is ambiguous |
| C. Replace the PoC | One clean root | Destroys the PoC (it can be archived to a branch first) |

This plan sits in `quarry/docs/` so it moves cleanly under any option.

---

## 1. Architecture

### 1.1 Processes

```
                          ┌───────────────────────────── browser (localhost) ─────────────────────────────┐
                          │  React/TS SPA: dockview panels · command line · AG Grid · Lightweight Charts   │
                          │  TanStack Query (REST)          one multiplexed WebSocket  /ws                 │
                          └───────────────▲───────────────────────────────▲───────────────────────────────┘
                                          │ REST (OpenAPI)                │ {op:sub, topics:[...]} / coalesced ticks
┌─────────────────────────────────────────┴───────────────────────────────┴──────────────────────────────┐
│ api  (FastAPI/Uvicorn)                                                                                   │
│  routers: /health /status /instruments /bars /quotes /news /functions/*      WS gateway (250 ms coalesce)│
│  ProviderRouter (priority + fallback + provenance)   licence guard   settings (pydantic-settings)        │
└──────┬───────────────────────────────┬──────────────────────────────────────▲─────────────────────────┘
       │ SQL (async)                   │ GET/SET, token buckets                │ SUBSCRIBE quotes:{id} news:{topic}
┌──────▼──────────┐          ┌─────────▼─────────┐                ┌────────────┴───────────────────────────┐
│ Postgres 16 +   │          │ Valkey/Redis      │◄── PUBLISH ────│ worker  (APScheduler + asyncio)        │
│ TimescaleDB     │◄─────────│ hot quotes,       │                │  SubscriptionManager (ref-counted)     │
│ ref, bars,      │  writes  │ pub/sub, limits,  │                │  stream clients: Finnhub WS, Alpaca WS │
│ news, app state │          │ locks             │                │  pollers: Twelve Data, FMP, RSS, ...   │
└─────────────────┘          └───────────────────┘                │  normalise → store → publish           │
       ▲                                                          └───────────────┬────────────────────────┘
       │ nightly export (P3+)   ┌──────────────────┐                              │ HTTPS / WSS
       └────────────────────────│ DuckDB + Parquet │                    external providers (§3)
                                │ data/lake/       │
                                └──────────────────┘
```

- **api** and **worker** are separate processes from one Python package
  (`quarry`). Only the worker talks upstream for streams. The api may call REST
  providers on a cache miss (e.g. DES), always through the router and the
  shared Redis rate limiter, so both processes respect one budget.
- The SubscriptionManager lives in the worker. The api records UI interest in
  Redis (`interest:{instrument_id}` counters with TTL heartbeats). The worker
  reconciles that against upstream subscriptions under each provider's symbol
  cap. Anything over the cap is put on REST polling and labelled accordingly.
- DuckDB/Parquet is not needed until the Phase 3 screener. Phase 0 only creates
  the folder and config.

### 1.2 Core contracts (fixed in Phase 0, used everywhere)

- `Provenance`: `source, source_record_id, fetched_at, as_of, latency_class, licence_flags`.
- `LatencyClass = realtime | delayed_15m | eod | indicative`, plus a `venue`
  label (e.g. `IEX`) so IEX-only prices are never mistaken for consolidated ones.
- `LicenceFlags`: `personal_only, display_allowed, redistribution_allowed, attribution_text`.
- `Money`/`Price`: `Decimal` + ISO currency + `pence: bool` (GBp is normalised
  to GBP with the flag kept, and the UI can show either).
- `InstrumentId`: internal ULID. Provider symbology (`VOD.L`, `VOD:LN`,
  `VOD.LSE`) lives in `instrument_alias`.
- Capability manifest per adapter (asset classes, MICs, fields, latency, limits,
  cost tier, licence), loaded and validated from `config/providers.yaml`.

### 1.3 Decisions to record as ADRs in Phase 0

| ADR | Decision | Why / alternative |
|---|---|---|
| 0001 | Vite SPA, not Next.js | Local, single-user, websocket-heavy, no SEO |
| 0002 | **Valkey 8 instead of Redis 7** | Redis 7.4+ is RSALv2/SSPL (Redis 8 adds AGPLv3), which breaks the "permissive by default" rule. Valkey is the BSD-3 fork and a drop-in replacement. **Needs approval** |
| 0003 | **TimescaleDB under the Timescale License (TSL)** | Hypertable compression and continuous aggregates are TSL features, not Apache-2.0. TSL allows free self-hosted use but is not OSI-approved, so **needs approval**. Fallback: Apache-only Timescale or native Postgres partitioning, with rollups as materialised views refreshed by the worker |
| 0004 | dockview (MIT) for docking | Maintained, TS-native, serialisable layouts. FlexLayout (ISC) is the fallback |
| 0005 | One package, two entrypoints (`quarry.api`, `quarry.worker`) | Shared models; split later if needed |
| 0006 | ULID instrument IDs plus alias table | Provider-agnostic identity |
| 0007 | Commands parsed client-side against a registry served by `/functions` | One source of truth for autocomplete, HELP and routing |
| 0008 | OpenAPI → TS client generated with `openapi-typescript` | No hand-written API types |

---

## 2. Repository tree (Phase 0–1 scope; later packages stubbed)

```
quarry/
├── CLAUDE.md
├── README.md
├── LICENSE                       # private/proprietary for now (your call)
├── Makefile                      # dev, test, lint, typecheck, migrate, seed, backfill, e2e, smoke-live
├── docker-compose.yml            # timescale, valkey, api, worker, web
├── .env.example
├── .gitignore  .gitleaks.toml  .pre-commit-config.yaml
├── .github/workflows/ci.yml      # lint, types, tests, build, audit (no live calls)
├── config/
│   ├── providers.yaml            # priorities, limits, licence flags per adapter
│   ├── features.yaml             # feature flags (paid adapters off)
│   ├── functions.yaml            # command registry: code, args, phase, panel, help
│   └── credit_scorecard.yaml     # stub (P3)
├── docs/
│   ├── PLAN.md  DECISIONS.md  PROVIDERS.md  LEGAL.md  OPEN_QUESTIONS.md
│   └── functions/<CODE>.md       # one per shipped function
├── backend/
│   ├── pyproject.toml  uv.lock
│   ├── alembic.ini  migrations/
│   ├── src/quarry/
│   │   ├── core/                 # settings, logging (redaction), errors, time, money, ids, provenance
│   │   ├── api/                  # app factory, routers/, ws/ gateway, deps
│   │   ├── worker/               # main, scheduler, subscription_manager
│   │   ├── providers/
│   │   │   ├── base.py           # Protocols + CapabilityManifest
│   │   │   ├── router.py         # priority/fallback/provenance stamping
│   │   │   ├── ratelimit.py      # Redis token buckets + budget counters
│   │   │   ├── finnhub/  alpaca/  twelvedata/  fmp/  eodhd/  rss/  openfigi/
│   │   ├── normalise/            # symbology, currency/pence, calendars, bars
│   │   ├── ingest/               # streams, pollers, backfill
│   │   ├── storage/              # SQLAlchemy models, repos, redis cache
│   │   ├── news/                 # P1: basic ingest + exact dedupe only
│   │   ├── analytics/  ai/  alerts/  screener/  portfolio/   # empty packages until their phase
│   └── tests/
│       ├── unit/  contract/ (recorded fixtures)  integration/  fixtures/
├── frontend/
│   ├── package.json  pnpm-lock.yaml  vite.config.ts  tsconfig.json  tailwind.config.ts
│   ├── src/
│   │   ├── app/                  # shell, providers, routing
│   │   ├── design/               # tokens (colours, type, density), theme, colour-blind palette
│   │   ├── terminal/             # command line, parser, registry, history, keymap, status bar
│   │   ├── workspace/            # dockview wrapper, link groups, layout persistence
│   │   ├── realtime/             # single WS client, topic store, flash
│   │   ├── api/                  # generated OpenAPI client
│   │   ├── components/           # ValueCell (tooltip: source/as_of/latency), LatencyBadge, Grid, Chart
│   │   └── functions/            # feature folders: des/ gp/ hp/ wl/ wei/ most/ news/ stat/ help/
│   └── e2e/                      # Playwright
└── data/                         # git-ignored: lake/, raw/, backups/
```

---

## 3. Dependencies, providers, cost and licence

### 3.1 Software (all free)

| Layer | Package | Licence | Note |
|---|---|---|---|
| Python | uv, FastAPI, Uvicorn, Pydantic v2, pydantic-settings, httpx, websockets, SQLAlchemy 2, asyncpg, Alembic, APScheduler 3.x, structlog, python-ulid, duckdb (P3) | MIT / BSD / Apache-2.0 | |
| Py test/quality | pytest, pytest-asyncio, respx, freezegun, ruff, mypy, pip-audit | MIT / BSD / Apache-2.0 | |
| Py test | hypothesis | **MPL-2.0** | Weak copyleft, test-only and never distributed. I consider this acceptable, but flagging it per rule 4 |
| Data stores | PostgreSQL 16 | PostgreSQL (permissive) | |
| | TimescaleDB | **TSL / Apache-2.0** | See ADR-0003, needs approval |
| | Valkey 8 (vs Redis 7) | BSD-3 (vs RSAL/SSPL/AGPL) | See ADR-0002, needs approval |
| Frontend | React 18, TypeScript, Vite, Zustand, TanStack Query, cmdk, Tailwind, dockview, AG Grid Community, ECharts (P2), openapi-typescript, DOMPurify | MIT / Apache-2.0 / (DOMPurify Apache-2.0 or MPL-2.0, use Apache) | AG Grid **Community** only; Enterprise features are commercial |
| | TradingView Lightweight Charts | Apache-2.0 + **attribution** (NOTICE requires a TradingView link/notice on the page) | Shown in a footer/LIC page |
| FE test | Vitest, React Testing Library, Playwright | MIT / Apache-2.0 | |
| Tooling | gitleaks, pre-commit | MIT | |

### 3.2 Data providers

Phase 0–1 uses **Tier 0 only (≈ $0/mo)**. Nothing paid is added without asking.

| Provider | Used in | Cost | Limits † | Licence | Phase |
|---|---|---|---|---|---|
| Finnhub free | US quotes WS, company profile, company/market news | $0 | 60/min, 50 WS symbols | Personal use; attribution | P1 |
| Alpaca Basic | US real-time IEX WS, bars, movers/most-actives screener | $0 (account needed) | 200/min, 30 WS symbols; SIP 15-min delayed | Personal/non-display terms; label "IEX" | P1 |
| Twelve Data Basic | Global EOD bars, FX, index/ETF proxies | $0 | 8 credits/min, 800/day | Personal | P1 |
| FMP Basic | Profiles, EOD, US fundamentals (P3) | $0 | 250/day | Personal | P1 |
| EODHD free | LSE EOD fallback / testing | $0 | 20/day | Personal | P1 |
| OpenFIGI | ISIN/ticker → FIGI mapping | $0 (key optional) | 25 req/min without key | Open (Bloomberg-run, but the data is open; name not used in UI) | P1 |
| RSS (BBC Business, CNBC, central banks, SEC, ONS) | Headlines + links | $0 | Polite polling | Headline + link only | P1 |
| FRED, BoE, ECB, ONS, BLS, Treasury, CoinGecko Demo, Binance/Coinbase WS, OANDA practice | Macro, rates, crypto, FX | $0 | per prompt | FRED notice; CoinGecko attribution | P2 |
| SEC EDGAR, Companies House | Filings, registry | $0 | 10 req/s + UA; 600 req/5 min | Public | P3 |
| Marketaux free, GDELT, Benzinga Basic | News enrichment | $0 | 100/day etc. | Headline/teaser/link | P4 |
| Anthropic API | AI layer | Usage-based; hard cap in config | — | — | P4 |
| Paid (EODHD AIO, Alpaca AT+, Tiingo, FMP, Massive, Twelve Data Pro, IBKR, Tradier, Databento, RNS) | Upgrades | per prompt † | | Mostly personal-only | Behind flags, **ask first** |

---

## 4. Risks (ranked)

1. **Free-tier UK coverage may be close to nil.** Finnhub free and FMP Basic
   are largely US-only for quotes, and Twelve Data Basic may not cover LSE (to
   verify in P1.1). EODHD free is 20 calls/day. The Phase 1 acceptance check
   `VOD LN DES` may therefore need EOD-only data from EODHD, or an early
   EODHD EOD ($19.99) upgrade. *Mitigation:* verify on day 1 of Phase 1. DES
   data is cached for 24h; UK is shown as EOD with a badge. Yahoo and other
   scraping are ruled out by the non-goals.
2. **Index values are licensed.** Free FTSE/S&P index levels are scarce, so
   WEI will mostly show ETF proxies (e.g. ISF.L, SPY), labelled `PROXY` with
   the underlying ETF named.
3. **Free-tier symbol caps** (Alpaca 30, Finnhub 50). A 20-symbol US watchlist
   fits; several panels plus WEI may not. *Mitigation:* ref-counting, polling
   fallback, and caps shown on STAT.
4. **Licence creep.** Personal-only data could end up somewhere public (a
   screenshot or deployed demo). *Mitigation:* licence flags from day 1, a
   localhost bind and an export guard stub.
5. **Infra licences** (Redis, Timescale TSL), covered in ADRs 0002/0003.
6. **Scope.** The full plan is about 45 functions across 8 phases. Strict phase
   gates prevent half-built panels.
7. **Vendor churn and unverified figures (†).** All are rechecked when each
   adapter is built and logged with a verified date.
8. **GBp/GBP errors** can silently cause ×100 mistakes. *Mitigation:*
   property tests and a pence flag that persists into the UI.
9. **Key leakage into the frontend bundle.** *Mitigation:* the browser never
   calls providers directly. CI greps the built bundle for key patterns and
   gitleaks runs on commit.
10. **AI cost/hallucination** (P4+). Not in scope now, but the fact/provenance
    model is designed in Phase 0 so P4 has nothing to retrofit.

---

## 5. Phase 0 — Foundations

Estimates are in focused working days (one person with Claude Code). Total ≈ **5–7 days**.

| # | Task | Est. |
|---|---|---|
| 0.1 | Repo scaffold, `.gitignore`, LICENSE choice, pre-commit (ruff, mypy, prettier/eslint, gitleaks) | 0.25 |
| 0.2 | `CLAUDE.md` (§18), `docs/DECISIONS.md` (ADRs 0001–0008), `PROVIDERS.md` (skeleton + verification column), `LEGAL.md`, `OPEN_QUESTIONS.md` | 0.5 |
| 0.3 | Backend package via uv; `core/settings.py` (typed, validates at startup, `SecretStr`), `.env.example`; structlog JSON with secret redaction + test | 0.5 |
| 0.4 | Core types: Provenance, LatencyClass, LicenceFlags, Money/pence, ULID ids + unit/property tests | 0.5 |
| 0.5 | docker-compose (timescale, valkey, api, worker, web) with healthchecks; Makefile targets | 0.5 |
| 0.6 | SQLAlchemy async + Alembic baseline: `instrument`, `instrument_alias`, `exchange`, `workspace_layout`, `command_history`, `provider_status` | 0.5 |
| 0.7 | Provider framework: Protocols, CapabilityManifest, `providers.yaml` loader + schema validation, Redis token bucket + budget counters (tests with fakeredis or a container) | 0.75 |
| 0.8 | `/health` (db, redis, worker heartbeat) and `/status` (per-provider state, last message, headroom, errors) | 0.25 |
| 0.9 | Frontend scaffold: Vite + TS strict + Tailwind + design tokens (near-black, own amber, cyan links, colour-blind palette toggle, tabular numerals) | 0.5 |
| 0.10 | Shell: dockview workspace, panel registry, link-colour groups, save/restore named layouts (`/workspaces` API) | 0.75 |
| 0.11 | Command line: `<SECURITY> <FUNCTION> [args]` parser (pure, unit-tested), registry from `/functions`, fuzzy autocomplete, Tab, history, Enter/Shift+Enter, graceful unknown-command panel; keymap (F1, Esc, Ctrl+1..9, Ctrl+L, Ctrl+S, `?`) | 0.75 |
| 0.12 | Status bar: London/NY/Tokyo/UTC clocks, provider health dots | 0.25 |
| 0.13 | CI: backend lint/type/test, frontend lint/type/test/build, pip-audit/npm audit, bundle key-grep; Playwright smoke (shell loads, unknown command handled) | 0.5 |

**Acceptance criteria:** `make dev` works from a clean clone; `/health` is
green; all tests and lint pass in CI; an unknown command shows a helpful panel;
a saved layout restores after reload.

---

## 6. Phase 1 — MVP terminal

Total ≈ **10–14 days**.

| # | Task | Est. |
|---|---|---|
| 1.1 | **Verify provider docs and coverage** (esp. LSE on each free tier), fill PROVIDERS.md with the verified date, finalise `providers.yaml` priorities | 0.5 |
| 1.2 | Reference data: exchanges (XNYS, XNAS, XLON incl. AIM segment), seed US + LSE universe (Finnhub/FMP symbol lists, EODHD LSE list), OpenFIGI mapping, alias table, `/instruments/search` (pg_trgm) | 1.5 |
| 1.3 | Trading calendars (NYSE, LSE) with holiday fixtures; market-open badges | 0.5 |
| 1.4 | Normalisation: symbology resolver (`VOD LN` → instrument), GBp→GBP with pence flag, UTC, bar adjustment flags. Property tests | 1 |
| 1.5 | Adapters + recorded-fixture contract tests: Finnhub (REST + WS), Alpaca (REST + IEX WS + movers), Twelve Data (EOD/FX), FMP (profile/EOD), EODHD (EOD/LSE), RSS | 2.5 |
| 1.6 | ProviderRouter: priority, fallback on error/limit, provenance stamping, budget accounting | 0.5 |
| 1.7 | Worker: SubscriptionManager (ref-count, caps, polling fallback), stream clients with jittered exponential backoff (reconnect < 10s), Redis publish; `bar` hypertable + EOD backfill job | 1.5 |
| 1.8 | API WS gateway: `/ws` sub/unsub, 250 ms per-topic coalescing, message envelope (`instrument_id, fields, source, as_of, received_at, latency_class`). Ref-count/throttle/reconnect tests | 1 |
| 1.9 | UI primitives: `ValueCell` (flash, tooltip with source/as_of/latency/venue), `LatencyBadge`, AG Grid monitor, Lightweight Charts wrapper (+ attribution) | 1 |
| 1.10 | Functions: **DES**, **GP** (daily, 1D–MAX ranges), **GIP** (intraday where available), **HP**, **WL** (multiple lists, live), **WEI** (proxies labelled), **MOST** (US via Alpaca movers) | 2.5 |
| 1.11 | Basic news: Finnhub market/company news + RSS, canonical URL + exact dedupe, `news_item` table, NEWS panel (headline/link/time/source, no full text) | 1 |
| 1.12 | **STAT**: provider state, rate-limit headroom, daily budget (warn at 80%) | 0.5 |
| 1.13 | E2E + acceptance: `AAPL US GP 1Y`, `VOD LN DES`, 20-symbol WL live/badged, network-drop reconnect test (toxiproxy or a kill-socket test), bundle/log key scan; `docs/functions/*.md` | 1 |

**Acceptance criteria (from the brief):** `AAPL US GP 1Y` and `VOD LN DES` show
correct data with source and as_of; a 20-symbol watchlist updates live (US) or
shows delayed/EOD badges (UK); streams reconnect within 10s of a network drop;
no key appears in logs or the frontend bundle.

---

## 7. Proposed default config (changeable)

- `MODE=personal`, bind `127.0.0.1`, base currency `GBP`.
- AI (P4) models from config: `AI_MODEL_DEEP=claude-opus-5-5`,
  `AI_MODEL_STANDARD=claude-sonnet-5-5`, `AI_MODEL_FAST=claude-haiku-5-5`, all
  verified via the Models API at startup. Pricing is re-checked before P4.
- `SEC_USER_AGENT="QUARRY/0.1 <your contact email>"`, used from P3.

## 8. Questions for Zack

1. **Repo placement:** A (new repo, recommended), B (subdirectory here), or C (replace the PoC)?
2. **Licences:** OK to use Valkey instead of Redis (ADR-0002)? OK to accept TimescaleDB's TSL (ADR-0003), or should I use the Apache-only fallback?
3. **Free API keys you already have:** Finnhub, Alpaca, Twelve Data, FMP, EODHD, FRED, Companies House, CoinGecko, OANDA, Marketaux?
4. **Base currency:** GBP (default)?
5. **First 20 watchlist tickers** (mixed US/LSE is fine; it tests the delayed-badge path).
6. **IBKR account?** If yes, is it IBKR (UK)? This decides the real-time LSE route.
7. **Runtime target:** local Docker on a laptop (Mac/Windows/Linux?) or a VPS?
8. **Contact email** for the SEC User-Agent (P3). Fine to defer.
