#!/usr/bin/env bash
set -euo pipefail
# Local files only. Never links, pushes, resets or executes SQL.
command -v supabase >/dev/null || { echo 'Install the Supabase CLI first.' >&2; exit 1; }
supabase migration new --help >/dev/null
for draft in v1_1 android-fixes privacy-requests security-hardening; do
  migration_name="hikmahhub_${draft//-/_}"
  test -f "db/$draft.sql"
  if compgen -G "supabase/migrations/*_${migration_name}.sql" >/dev/null; then
    echo "A prepared $draft migration already exists; review it instead of duplicating it." >&2
    exit 1
  fi
  supabase migration new "$migration_name"
  migration_path=$(find supabase/migrations -name "*_${migration_name}.sql" -print | sort | tail -n 1)
  test -n "$migration_path"
  cp "db/$draft.sql" "$migration_path"
  echo "Prepared $migration_path for review; no database changed."
  sleep 1 # distinct CLI-generated versions even on fast machines
 done
