-- REVIEW ONLY, unapplied. After v1_1.sql, android-fixes.sql, privacy-requests.sql.
-- Preserves data and existing public previews. No Auth or Storage configuration changes.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
-- RLS does not govern TRUNCATE. Clients use row operations, never these privileges.
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from public, anon, authenticated;
revoke insert, update, delete on public.public_product_previews, public.public_vendor_previews from public, anon, authenticated;
grant select on public.public_product_previews, public.public_vendor_previews to anon, authenticated;

alter table public.event_comments add column updated_at timestamptz not null default now();
create index event_comments_author_created on public.event_comments(user_id,created_at desc);
create function private.require_active_student() returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.ensure_my_profile();
 if not exists(select 1 from public.profiles where id=auth.uid() and is_active) then
  raise exception 'Active account required' using errcode='42501';
 end if;
end $$;
revoke all on function private.require_active_student() from public,anon,authenticated;
create or replace function public.add_event_comment(p_event uuid,p_body text) returns void
language plpgsql security definer set search_path='' as $$
declare first text;
begin
 perform private.require_active_student();
 if not exists(select 1 from public.events where id=p_event and status='published') then raise exception 'Published event required'; end if;
 if char_length(btrim(coalesce(p_body,''))) not between 1 and 1000 then raise exception 'Comment must contain 1 to 1000 characters'; end if;
 -- Serialise per author so concurrent requests cannot bypass the posting limits.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,431));
 if exists(select 1 from public.event_comments where user_id=auth.uid() and created_at>now()-interval '30 seconds')
 or (select count(*) from public.event_comments where user_id=auth.uid() and created_at>now()-interval '1 hour')>=20 then
  raise exception 'Please wait before posting another comment' using errcode='P0001';
 end if;
 select coalesce(nullif((regexp_split_to_array(btrim(full_name),'[[:space:]]+'))[1],''),'Student') into first from public.profiles where id=auth.uid();
 insert into public.event_comments(event_id,user_id,first_name,body) values(p_event,auth.uid(),left(first,120),btrim(p_body));
end $$;
create function public.get_event_comments(p_event uuid,p_offset integer default 0,p_limit integer default 25)
returns table(id uuid,first_name text,body text,created_at timestamptz,updated_at timestamptz,is_mine boolean)
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_active_student();
 if not exists(select 1 from public.events where events.id=p_event and status='published') then raise exception 'Published event required'; end if;
 return query select c.id,c.first_name,c.body,c.created_at,c.updated_at,c.user_id=auth.uid()
 from public.event_comments c where c.event_id=p_event and not c.hidden order by c.created_at,c.id
 offset greatest(coalesce(p_offset,0),0) limit least(greatest(coalesce(p_limit,25),1),50);
end $$;
create function public.edit_event_comment(p_comment uuid,p_body text,p_expected timestamptz) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_active_student();
 if char_length(btrim(coalesce(p_body,''))) not between 1 and 1000 then raise exception 'Comment must contain 1 to 1000 characters'; end if;
 update public.event_comments c set body=btrim(p_body),updated_at=clock_timestamp()
 where c.id=p_comment and c.user_id=auth.uid() and not c.hidden and c.updated_at=p_expected
 and exists(select 1 from public.events e where e.id=c.event_id and e.status='published');
 if not found then raise exception 'Comment changed or unavailable' using errcode='42501'; end if;
end $$;
create function public.remove_event_comment(p_comment uuid,p_expected timestamptz) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_active_student();
 -- Keep the FK target for existing reports. Restricted report snapshots are not erased.
 update public.event_comments set body='[Removed by author]',first_name='Student',hidden=true,updated_at=clock_timestamp()
 where id=p_comment and user_id=auth.uid() and updated_at=p_expected and body<>'[Removed by author]';
 if not found then raise exception 'Comment changed or unavailable' using errcode='42501'; end if;
end $$;
revoke all on function public.get_event_comments(uuid,integer,integer),public.edit_event_comment(uuid,text,timestamptz),public.remove_event_comment(uuid,timestamptz) from public,anon;
grant execute on function public.get_event_comments(uuid,integer,integer),public.edit_event_comment(uuid,text,timestamptz),public.remove_event_comment(uuid,timestamptz) to authenticated;
commit;
