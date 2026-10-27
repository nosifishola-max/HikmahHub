-- REVIEW ONLY. Not applied. Requires the existing HikmahHub schema.
-- Generate a timestamped migration via scripts/prepare-migration.sh after review.
begin;

-- Profiles are already owner/admin-only under RLS; never add matric to previews.
-- The index checks normalized uniqueness WITHOUT rewriting existing profile data.
-- A duplicate causes this transaction to fail safely; resolve only with owner approval.
create unique index profiles_matric_normalized_unique on public.profiles
  ((nullif(upper(regexp_replace(matric_number, '[[:space:]]', '', 'g')), '')))
  where nullif(upper(regexp_replace(matric_number, '[[:space:]]', '', 'g')), '') is not null;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create function private.normalize_profile_matric() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.matric_number = nullif(upper(regexp_replace(new.matric_number, '[[:space:]]', '', 'g')), '');
  return new;
end $$;
revoke all on function private.normalize_profile_matric() from public, anon, authenticated;
create trigger normalize_profile_matric before insert or update of matric_number on public.profiles
for each row execute function private.normalize_profile_matric();
create function private.require_vendor_identity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Existing approved/suspended/pending vendors retain their current flows.
  if TG_OP = 'INSERT' or (old.status = 'rejected' and new.status = 'pending') then
    if not exists (select 1 from public.profiles p where p.id = new.owner_id
      and nullif(regexp_replace(p.matric_number, '[[:space:]]', '', 'g'), '') is not null
      and nullif(btrim(p.faculty), '') is not null and nullif(btrim(p.department), '') is not null)
    then raise exception 'Matric number, faculty and department are required'; end if;
  end if;
  return new;
end $$;
revoke all on function private.require_vendor_identity() from public, anon, authenticated;
create trigger require_vendor_identity before insert or update of status on public.vendors
for each row execute function private.require_vendor_identity();

create table public.event_likes (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(event_id,user_id)
);
alter table public.event_likes enable row level security;
revoke all on public.event_likes from anon, authenticated;
-- Likes are exposed as aggregates through checked RPCs, never as a list of users.
create table public.event_comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  first_name text not null,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index event_comments_event_created on public.event_comments(event_id,created_at);
alter table public.event_comments enable row level security;
revoke all on public.event_comments from anon, authenticated;
grant select(id,event_id,first_name,body,hidden,created_at) on public.event_comments to authenticated;
create policy event_comments_read on public.event_comments for select to authenticated
using ((not hidden or (select public.is_admin())) and exists (
  select 1 from public.events e where e.id = event_id and (e.status = 'published' or (select public.is_admin()))));

create function public.get_event_likes(p_event uuid)
returns table(like_count bigint, liked boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.events where id=p_event and status='published') then
    raise exception 'Published event and sign in required'; end if;
  return query select count(*), coalesce(bool_or(l.user_id=auth.uid()), false)
    from public.event_likes l where l.event_id=p_event;
end $$;
create function public.set_event_like(p_event uuid, p_like boolean)
returns table(like_count bigint, liked boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.events where id=p_event and status='published') then
    raise exception 'Published event and sign in required'; end if;
  if p_like then insert into public.event_likes(event_id,user_id) values(p_event,auth.uid()) on conflict do nothing;
  else delete from public.event_likes where event_id=p_event and user_id=auth.uid(); end if;
  return query select * from public.get_event_likes(p_event);
end $$;
create function public.add_event_comment(p_event uuid,p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  if auth.uid() is null or not exists(select 1 from public.events where id=p_event and status='published') then
    raise exception 'Published event and sign in required'; end if;
  select coalesce(nullif((regexp_split_to_array(btrim(p.full_name), '[[:space:]]+'))[1],''),'Student') into v_name
    from public.profiles p where p.id=auth.uid();
  insert into public.event_comments(event_id,user_id,first_name,body)
    values(p_event,auth.uid(),coalesce(v_name,'Student'),btrim(p_body));
end $$;
revoke all on function public.get_event_likes(uuid), public.set_event_like(uuid,boolean), public.add_event_comment(uuid,text) from public, anon;
grant execute on function public.get_event_likes(uuid), public.set_event_like(uuid,boolean), public.add_event_comment(uuid,text) to authenticated;

alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
check(target_type in ('product','store','event','deal','event_comment'));
-- Reporters cannot forge moderation status or reviewer identity at insert time.
drop policy reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated
with check (reporter_id = (select auth.uid()) and status = 'open' and resolved_by is null and resolved_at is null);
-- Preserve all existing report resolution paths and audit logging.
create or replace function public.admin_resolve_report(p_report uuid,p_status text,p_hide_target boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.reports;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  if p_status not in ('reviewing','resolved','dismissed') then raise exception 'Invalid status'; end if;
  update public.reports set status=p_status,resolved_by=auth.uid(),resolved_at=case when p_status <> 'reviewing' then now() end
    where id=p_report returning * into r;
  if r.id is null then raise exception 'Report not found'; end if;
  if p_hide_target then
    if r.target_type='product' then update public.products set status='hidden' where id=r.target_id;
    elsif r.target_type='store' then update public.vendors set status='suspended',is_verified=false where id=r.target_id;
    elsif r.target_type='deal' then update public.campus_deals set status='hidden' where id=r.target_id;
    elsif r.target_type='event' then update public.events set status='cancelled' where id=r.target_id;
    elsif r.target_type='event_comment' then update public.event_comments set hidden=true where id=r.target_id;
    end if;
  end if;
  insert into public.admin_actions(admin_id,action,target_type,target_id,details)
    values(auth.uid(),'report_'||p_status,r.target_type,r.target_id,jsonb_build_object('report',p_report,'hidden',p_hide_target));
end $$;
revoke all on function public.admin_resolve_report(uuid,text,boolean) from public, anon;
grant execute on function public.admin_resolve_report(uuid,text,boolean) to authenticated;
commit;
