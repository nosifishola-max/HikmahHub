-- Disposable PostgreSQL compatibility harness, not a production auth/storage clone.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema storage;
create schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select current_user::text $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create table storage.objects(id uuid primary key,name text,bucket_id text,metadata jsonb,created_at timestamptz default now(),owner uuid);
grant usage on schema public,auth to anon,authenticated;
grant execute on all functions in schema auth to anon,authenticated;
set check_function_bodies = off;
