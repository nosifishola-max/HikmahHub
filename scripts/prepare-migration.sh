#!/usr/bin/env bash
set -euo pipefail
# Creates a local migration only. Never links, pushes or resets any database.
command -v supabase >/dev/null || { echo 'Install the Supabase CLI first.' >&2; exit 1; }
supabase migration new --help >/dev/null
supabase migration new hikmahhub_v1_1
migration_path=$(find supabase/migrations -name '*_hikmahhub_v1_1.sql' -print | sort | tail -n 1)
test -n "$migration_path"
cp db/v1_1.sql "$migration_path"
echo "Prepared $migration_path for review; no database changed."
