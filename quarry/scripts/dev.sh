#!/usr/bin/env bash
# Run api (reload), worker and the Vite dev server together; Ctrl+C stops all three.
set -euo pipefail
cd "$(dirname "$0")/.."
trap 'trap - EXIT INT TERM; kill 0' EXIT INT TERM
(cd backend && ENV=dev uv run quarry-api) &
(cd backend && uv run quarry-worker) &
(cd frontend && pnpm dev) &
wait
