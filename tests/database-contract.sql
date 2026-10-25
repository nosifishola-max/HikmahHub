-- Run ONLY against a disposable local copy after applying db/v1_1.sql.
-- Catalog contract checks; role/fixture behavior must also follow the release matrix.
begin read only;
do $$
begin
  if not (select relrowsecurity from pg_class where oid='public.event_comments'::regclass)
    or not (select relrowsecurity from pg_class where oid='public.event_likes'::regclass)
    then raise exception 'Event tables need RLS'; end if;
  if has_column_privilege('authenticated','public.event_comments','user_id','SELECT')
    or has_table_privilege('authenticated','public.event_likes','SELECT')
    then raise exception 'Private event user identities exposed'; end if;
  if has_function_privilege('anon','public.add_event_comment(uuid,text)','EXECUTE')
    or has_function_privilege('anon','public.set_event_like(uuid,boolean)','EXECUTE')
    or has_function_privilege('anon','public.admin_resolve_report(uuid,text,boolean)','EXECUTE')
    then raise exception 'Anonymous write/moderation RPC access'; end if;
  if not has_function_privilege('authenticated','public.add_event_comment(uuid,text)','EXECUTE')
    then raise exception 'Comment RPC unavailable'; end if;
  if not exists(select 1 from pg_index where indexrelid='public.profiles_matric_normalized_unique'::regclass and indisunique)
    then raise exception 'Matric uniqueness missing'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.vendors'::regclass and tgname='require_vendor_identity')
    then raise exception 'Application identity guard missing'; end if;
end $$;
rollback;
