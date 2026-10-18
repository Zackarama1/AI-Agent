# Architecture decisions (ADR log)

Format: context → decision → consequences. Newest last.

## ADR-0001 Vite SPA, not Next.js
Local, single-user, websocket-heavy app with no SEO needs. A static SPA served by the
API is simpler to run and to install on an iPad. **Accepted.**

## ADR-0002 Valkey instead of Redis
Redis 7.4+ is RSALv2/SSPL (Redis 8 adds AGPLv3); the brief says permissive by default.
Valkey (BSD-3) is a drop-in replacement and the `redis` Python client (MIT) speaks to it.
**Accepted as a default** (Zack said "go"); CI and docker-compose use `valkey/valkey:8.1`.

## ADR-0003 TimescaleDB licence
Compression and continuous aggregates are under the Timescale License (free to self-host,
not OSI-approved). Phase 0 creates no hypertables, so plain Postgres 16 is enough (CI uses
`postgres:16`); docker-compose ships the Timescale image ready for Phase 1.
**Accepted as a default; revisit at Phase 1** (fallback: native partitioning + materialised views).

## ADR-0004 Docking: dockview-react (MIT)
dockview 8 split its React binding into `dockview-react`. It is used on desktop only and
lazy-loaded, so the iPad bundle stays small (~90 KB gzip). **Accepted.**

## ADR-0005 One Python package, two entrypoints
`quarry-api` and `quarry-worker` share models and config; can be split later. **Accepted.**

## ADR-0006 ULID instrument IDs + alias table
Provider-agnostic identity; provider symbology lives in `instrument_alias`. **Accepted.**

## ADR-0007 Command registry served by the API
`config/functions.yaml` → `/api/functions` is the single source for the parser,
autocomplete and HELP. The parser is a pure TS module with unit tests. **Accepted.**

## ADR-0008 Generated API types
`openapi-typescript` generates `frontend/src/api/schema.ts` from the backend schema; CI
fails if either the schema or the generated types are stale. **Accepted.**

## ADR-0009 iPad: Progressive Web App first
Same React app installed to the Home Screen from Safari. No App Store, Mac or developer fee.
Tablet layout = fixed 1–3 panes, function chips, swipe between workspaces, 44px targets.
A Capacitor wrapper for TestFlight/App Store remains possible later (needs a Mac).
The service worker caches the app shell only, never market data or API responses.
**Accepted.**

## ADR-0010 Remote access via Tailscale, single origin
The API serves the built SPA, so there is one origin and no CORS in production. The server
binds to 127.0.0.1; the iPad reaches it via `tailscale serve` (HTTPS with a valid cert,
which iOS needs for installable web apps). This replaces the separate `web` container in
the original plan. **Accepted.**

## ADR-0011 Workspaces persisted per form factor
Desktop (dockview geometry) and tablet (pane assignments) layouts differ, so
`workspace_layout` is keyed by `(name, form_factor)`. Edits autosave (debounced) to the API
with a localStorage copy for offline use. Commands typed while a workspace loads are queued
rather than overwritten. **Accepted.**
