#!/usr/bin/env bash
# One-command local launcher for the Concierge app.
#   ./run.sh            # sets everything up and starts the server
#   PORT=9000 ./run.sh  # start on a different port
#
# Creates a virtualenv, installs dependencies, downloads the Chromium the
# agent drives, bootstraps a .env, and starts the server. Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")"

PY="${PYTHON:-python3}"
command -v "$PY" >/dev/null || { echo "Python 3 not found. Install it and retry."; exit 1; }

if [ ! -d ".venv" ]; then
  echo "▶ Creating virtual environment (.venv)…"
  "$PY" -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

echo "▶ Installing dependencies…"
python -m pip install -q --upgrade pip
python -m pip install -q -r requirements.txt

# Skip the browser download only if you've pointed us at an existing binary.
if [ -z "${PLAYWRIGHT_CHROMIUM_PATH:-}" ]; then
  echo "▶ Ensuring Chromium is installed (first run only)…"
  python -m playwright install chromium >/dev/null
fi

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "▶ Created .env — add your ANTHROPIC_API_KEY there for real AI bookings."
fi

PORT="${PORT:-8000}"
LAN_IP="$( { hostname -I 2>/dev/null | awk '{print $1}'; } || true )"
echo
echo "✅ Starting Concierge"
echo "     This computer : http://localhost:${PORT}"
[ -n "${LAN_IP}" ] && echo "     Your phone    : http://${LAN_IP}:${PORT}  (same Wi-Fi, then 'Add to Home Screen')"
echo
exec python webserver.py
