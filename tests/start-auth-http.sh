#!/usr/bin/env bash
set -euo pipefail
test "${PGHOST:-}" = localhost
test "${PGDATABASE:-}" = hikmah_test
# Only CI localhost services. No Supabase project is linked or created.
TEST_JWT_SECRET=disposable-ci-jwt-secret-only-at-least-32-characters
export TEST_JWT_SECRET
psql -v ON_ERROR_STOP=1 -c 'create schema auth; alter role postgres set search_path to auth,public;'
docker run -d --name hikmah-auth --network host \
 -e GOTRUE_API_HOST=0.0.0.0 -e GOTRUE_API_PORT=9999 -e API_EXTERNAL_URL=http://127.0.0.1:9999 \
 -e GOTRUE_SITE_URL=http://localhost:5267 -e GOTRUE_DB_DRIVER=postgres \
 -e GOTRUE_DB_NAMESPACE=auth -e GOTRUE_DB_DATABASE_URL=postgres://postgres:localtest@127.0.0.1:5432/hikmah_test \
 -e GOTRUE_JWT_SECRET="$TEST_JWT_SECRET" -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
 -e GOTRUE_JWT_AUD=authenticated -e GOTRUE_MAILER_AUTOCONFIRM=true -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true \
 supabase/gotrue:v2.177.0
for attempt in {1..40}; do if curl -fsS http://127.0.0.1:9999/health >/dev/null; then break; fi; sleep 2; done
curl -fsS http://127.0.0.1:9999/health
psql -v ON_ERROR_STOP=1 -f tests/local-bootstrap.sql -f tests/public-schema.sql -f tests/public-grants.sql -f db/v1_1.sql -f db/android-fixes.sql
psql -v ON_ERROR_STOP=1 <<'SQL'
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create role authenticator login noinherit password 'local-api-only';
grant anon,authenticated to authenticator;
grant usage on schema public to authenticator;
SQL
docker run -d --name hikmah-rest --network host \
 -e PGRST_DB_URI=postgres://authenticator:local-api-only@127.0.0.1:5432/hikmah_test \
 -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$TEST_JWT_SECRET" \
 postgrest/postgrest:v12.2.12
for attempt in {1..40}; do if curl -fsS http://127.0.0.1:3000/ >/dev/null; then break; fi; sleep 2; done
node tests/auth-http.cjs
