#!/usr/bin/env bash
# Run the schema tests against a disposable local Postgres (16+).
# Usage: PGHOST=... PGPORT=... PGUSER=postgres supabase/tests/run.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
db=collabify_test_$$
psql -q -c "create database $db" >/dev/null
trap 'psql -q -c "drop database $db" >/dev/null' EXIT
psql -q -v ON_ERROR_STOP=1 -d "$db" -f "$here/supabase-stub.sql" 2>&1 | grep -v "wal_level\|HINT" || true
for m in "$here"/../migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d "$db" -f "$m"; done
psql -q -v ON_ERROR_STOP=1 -d "$db" -f "$here/rules.test.sql" 2>&1 | grep -E "NOTICE|ERROR|FAILED" | sed 's/^.*NOTICE:  //'
