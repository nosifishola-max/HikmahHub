-- REVIEW-ONLY migration draft. After v1_1.sql and android-fixes.sql.
-- Creates a request/review ledger; NO erasure, anonymisation, schedules or Auth changes.
begin;
create table public.account_deletion_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references auth.users(id) on delete set null,
 status text not null default 'pending_review' check(status in ('pending_review','in_review','on_hold','approved_for_erasure','withdrawn')),
 public_message text not null default 'Request received for review. Your account and data have not been deleted.',
 version integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index one_open_account_deletion on public.account_deletion_requests(user_id)
 where status in ('pending_review','in_review','on_hold','approved_for_erasure');
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public,anon,authenticated;
grant select on public.account_deletion_requests to authenticated;
create policy deletion_request_owner_read on public.account_deletion_requests for select to authenticated
using(user_id=(select auth.uid()) or (select public.is_admin()));
create table public.account_deletion_events (
 id bigint generated always as identity primary key,
 request_id uuid not null references public.account_deletion_requests(id),
 actor_id uuid references auth.users(id) on delete set null,
 action text not null,reason text not null,created_at timestamptz not null default now()
);
alter table public.account_deletion_events enable row level security;
revoke all on public.account_deletion_events from public,anon,authenticated;
grant select on public.account_deletion_events to authenticated;
create policy deletion_events_admin_read on public.account_deletion_events for select to authenticated using((select public.is_admin()));

create function private.require_recent_deletion_auth() returns void
language plpgsql security definer set search_path='' as $$
declare claims jsonb:=auth.jwt(); recent boolean;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='28000'; end if;
 -- Refreshing a token is NOT reauthentication. Use server-signed password AMR time.
 select exists(select 1 from jsonb_array_elements(coalesce(claims->'amr','[]'::jsonb)) a
  where a->>'method'='password' and (a->>'timestamp')::numeric between extract(epoch from now()-interval '5 minutes') and extract(epoch from now()+interval '30 seconds')) into recent;
 if not recent then raise exception 'Please confirm your password again' using errcode='28000'; end if;
 if not exists(select 1 from auth.sessions s where s.id=(claims->>'session_id')::uuid and s.user_id=auth.uid() and (s.not_after is null or s.not_after>now())) then
  raise exception 'Sign in again to confirm this request' using errcode='28000'; end if;
end $$;
revoke all on function private.require_recent_deletion_auth() from public,anon,authenticated;
create function public.request_account_deletion(p_confirmation text) returns public.account_deletion_requests
language plpgsql security definer set search_path='' as $$
declare r public.account_deletion_requests;
begin
 perform private.require_recent_deletion_auth();
 if p_confirmation is distinct from 'DELETE MY ACCOUNT' then raise exception 'Explicit confirmation required'; end if;
 -- A per-user transaction lock makes retries and concurrent double taps idempotent.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into r from public.account_deletion_requests where user_id=auth.uid() and status<>'withdrawn';
 if r.id is not null then return r; end if;
 insert into public.account_deletion_requests(user_id) values(auth.uid()) returning * into r;
 insert into public.account_deletion_events(request_id,actor_id,action,reason) values(r.id,auth.uid(),'requested','Confirmed by the account owner with recent password authentication.');
 return r;
end $$;
create function public.withdraw_account_deletion(p_request uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.account_deletion_requests;
begin
 perform private.require_recent_deletion_auth();
 select * into r from public.account_deletion_requests where id=p_request and user_id=auth.uid() for update;
 if r.id is null then raise exception 'Request unavailable'; end if;
 if r.status not in ('pending_review','in_review','on_hold') then raise exception 'Contact support before this request can change'; end if;
 update public.account_deletion_requests set status='withdrawn',public_message='You withdrew this request. Your account and data were not deleted.',version=version+1,updated_at=now() where id=r.id;
 insert into public.account_deletion_events(request_id,actor_id,action,reason) values(r.id,auth.uid(),'withdrawn','Withdrawn by the owner before erasure approval.');
end $$;
create function public.admin_review_account_deletion(p_request uuid,p_status text,p_message text,p_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare r public.account_deletion_requests;
begin
 if not public.is_admin() then raise exception 'Admin only' using errcode='42501'; end if;
 if p_status not in ('in_review','on_hold','approved_for_erasure') or p_status is null then raise exception 'Invalid review status'; end if;
 if char_length(btrim(coalesce(p_message,''))) not between 10 and 1000 then raise exception 'Explain the decision and any restricted retention to the user'; end if;
 select * into r from public.account_deletion_requests where id=p_request for update;
 if r.id is null or r.version<>p_version or r.status in ('withdrawn','approved_for_erasure') then raise exception 'Request changed; refresh before reviewing'; end if;
 update public.account_deletion_requests set status=p_status,public_message=btrim(p_message),version=version+1,updated_at=now() where id=r.id;
 insert into public.account_deletion_events(request_id,actor_id,action,reason) values(r.id,auth.uid(),p_status,btrim(p_message));
 -- No destructive executor exists. Approval records intent, NEVER completion.
end $$;
create function public.admin_deletion_inventory(p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid; result jsonb;
begin
 if not public.is_admin() then raise exception 'Admin only' using errcode='42501'; end if;
 select user_id into uid from public.account_deletion_requests where id=p_request;
 if uid is null then raise exception 'Account unavailable; use the restricted case record'; end if;
 select jsonb_build_object(
  'request_id',p_request,'account_id',uid,
  'vendors',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'status',v.status,'store_name',v.store_name)),'[]') from public.vendors v where v.owner_id=uid),
  'active_listings',(select count(*) from public.products p join public.vendors v on v.id=p.vendor_id where v.owner_id=uid and p.status='approved'),
  'open_reports',(select count(*) from public.reports r where r.status in ('open','reviewing') and (r.reporter_id=uid or r.target_id in(select id from public.vendors where owner_id=uid) or r.target_id in(select p.id from public.products p join public.vendors v on v.id=p.vendor_id where v.owner_id=uid) or r.target_id in(select id from public.event_comments where user_id=uid))),
  'vendor_files',(select coalesce(jsonb_agg(jsonb_build_object('bucket',o.bucket_id,'path',o.name)),'[]') from storage.objects o where o.bucket_id in ('product-images','product-originals','vendor-logos') and exists(select 1 from public.vendors v where v.owner_id=uid and split_part(o.name,'/',1)=v.id::text)),
  'shared_assets_require_manual_review',true,'erasure_performed',false
 ) into result;
 return result;
end $$;
revoke all on function public.request_account_deletion(text),public.withdraw_account_deletion(uuid),public.admin_review_account_deletion(uuid,text,text,integer),public.admin_deletion_inventory(uuid) from public,anon;
grant execute on function public.request_account_deletion(text),public.withdraw_account_deletion(uuid),public.admin_review_account_deletion(uuid,text,text,integer),public.admin_deletion_inventory(uuid) to authenticated;
commit;
