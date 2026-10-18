# QUARRY — guide for Claude Code

Personal, keyboard- and touch-driven multi-asset market terminal for Zack (UK). Single user,
personal-use data licences. Desktop browser **and iPad** (Home Screen web app). Original
name and design: never use "Bloomberg" or copy any proprietary terminal's trade dress.

**Current phase: 0 (Foundations) — complete, awaiting Zack's sign-off. Next: Phase 1.**
Full plan and acceptance criteria: `docs/PLAN.md`.

## Architecture

```
 iPad Safari (Home Screen PWA) / desktop browser
            │  HTTPS via `tailscale serve` (remote) or http://127.0.0.1:8000 (local)
            ▼
 ┌──────────────── api (FastAPI, also serves built SPA) ────────────────┐
 │ /api/health /api/status /api/functions /api/workspaces /api/history   │
 │ ProviderRouter · licence flags · settings · log redaction             │
 └──────┬──────────────────────────┬─────────────────────────────▲───────┘
        │ SQLAlchemy async         │ rate-limit buckets, status  │ pub/sub (P1+)
 ┌──────▼──────────┐       ┌───────▼────────┐          ┌─────────┴──────────────┐
 │ Postgres 16     │       │ Valkey/Redis   │◄─────────│ worker (APScheduler)   │
 │ (+Timescale P1) │       │                │          │ heartbeat; streams P1+ │
 └─────────────────┘       └────────────────┘          └────────────────────────┘
```

Frontend: React 19 + TS strict + Vite + Tailwind v4 + Zustand + TanStack Query.
Desktop layout = dockview (lazy-loaded); tablet layout = fixed 1–3 panes + function chips.

## Commands (run from `quarry/`)

| Task | Command |
|---|---|
| Install deps | `make install` |
| Full stack in Docker | `make up` → http://127.0.0.1:8000 |
| Hot-reload dev | `make dev` (DBs in Docker) or `make dev-native` |
| Tests | `make test` (integration tests need `TEST_DATABASE_URL` / `TEST_REDIS_URL`, else skipped) |
| Lint + types | `make lint` |
| Regenerate TS API types | `make openapi` (CI fails if stale) |
| E2E | stack running with `STATIC_DIR=frontend/dist`, then `make e2e` |

## Repo map

- `config/` — `providers.yaml` (manifests, limits, licences, routing), `features.yaml`,
  `functions.yaml` (terminal command registry; `available: true` when a function ships)
- `backend/src/quarry/` — `core/` (settings, logging, money, provenance, ids, errors),
  `api/` (app factory, routers), `worker/`, `providers/` (protocols, config, rate limit,
  status), `storage/` (models, db, cache). Later-phase packages are placeholders.
- `backend/migrations/` — Alembic (hand-written; keep models and migrations in sync)
- `frontend/src/` — `terminal/` (parser, completion, command line), `workspace/` (store,
  persistence, desktop/tablet layouts), `functions/` (panels), `components/`, `api/`
- `docs/` — PLAN, DECISIONS (ADRs), PROVIDERS, LEGAL, OPEN_QUESTIONS, DEPLOY, functions/

## Conventions

- Python: ruff + `mypy --strict`, Pydantic at boundaries, async I/O, typed errors
  (`core/errors.py`) → JSON `{error: {code, message, detail}}`.
- TypeScript: strict + `exactOptionalPropertyTypes`, no `any`, API types generated from OpenAPI.
- Money is `Decimal` + ISO currency; GBp/GBX normalise to GBP with `pence=True`.
- Timestamps are timezone-aware and stored in UTC.
- Every market record carries `Provenance` (source, as_of, latency_class, venue, licence).
- Conventional Commits. New features behind `config/features.yaml` flags.
- Touch targets ≥ 44px on the tablet layout. No hover-only information (tap to reveal).

## Provider rules

- **Ask Zack before adding any paid provider, API, SaaS or non-permissive licence.**
  Paid manifests ship `enabled: false`.
- Check vendor docs before writing an adapter; log differences in `docs/PROVIDERS.md`.
- All provider calls go through `RateLimiter` (shared Redis buckets) and the router.
- SEC EDGAR: ≤10 req/s, `SEC_USER_AGENT` with a contact email. Companies House: 600/5 min.
- Show attribution text (FRED, CoinGecko, TradingView charts) wherever their data appears.
- Never cache market data in the service worker. Label IEX-only prices "IEX".

## Secrets

Keys live only in `.env` (git-ignored) or the host environment. Never in code, logs,
the frontend bundle (`pnpm check:bundle` enforces) or chat. The log redactor masks
configured secrets and credential-looking query params.

## AI guardrails (Phase 4+)

Numbers in AI output come only from tool results as fact tokens; validator rejects stray
numbers; stale data never called live; research-only disclaimer on every artifact.

## Definition of done

Acceptance criteria for the phase pass; `make lint` and `make test` green; E2E green on
desktop and iPad viewports; docs updated (this file, DECISIONS, PROVIDERS, function docs).

## Known gaps

See `docs/OPEN_QUESTIONS.md`. The Dockerfile and docker-compose.yml have not been built
or run yet (the build environment had no Docker daemon); CI runs the stack natively.
Market holiday calendars arrive in Phase 1.
