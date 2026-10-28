-- DISPOSABLE DATABASE ONLY. Entire fixture rolled back. Never run on production.
begin;
do $$ begin
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'
 and (has_table_privilege('anon',c.oid,'TRUNCATE') or has_table_privilege('authenticated',c.oid,'TRUNCATE'))) then raise exception 'Client TRUNCATE privilege remains'; end if;
 if has_table_privilege('anon','public.public_vendor_previews','UPDATE') then raise exception 'Writable preview'; end if;
 if has_function_privilege('anon','public.get_event_comments(uuid,integer,integer)','EXECUTE') then raise exception 'Anonymous discussion RPC'; end if;
end $$;
set local role anon;
do $$ begin
 begin truncate public.site_settings; raise exception 'TEST: anonymous truncate accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into auth.users(id,email) values
('00000000-0000-0000-0000-000000000701','student-release@example.invalid'),
('00000000-0000-0000-0000-000000000702','vendor-release@example.invalid'),
('00000000-0000-0000-0000-000000000703','other-release@example.invalid');
insert into public.profiles(id,full_name) values
('00000000-0000-0000-0000-000000000701','Amina Private Family'),
('00000000-0000-0000-0000-000000000702','Legacy Vendor'),
('00000000-0000-0000-0000-000000000703','Other Student');
alter table public.vendors disable trigger require_vendor_identity;
insert into public.vendors(id,owner_id,store_name,slug,whatsapp_number,status,is_featured) values
('10000000-0000-0000-0000-000000000702','00000000-0000-0000-0000-000000000702','Legacy Release Store','legacy-release','2348012345678','approved',true);
alter table public.vendors enable trigger require_vendor_identity;
insert into public.events(id,title,slug,starts_at,status) values
('20000000-0000-0000-0000-000000000701','Release event','release-event',now(),'published');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000701',true);
select public.add_event_comment('20000000-0000-0000-0000-000000000701','Original comment');
do $$ declare c record; begin
 select * into c from public.get_event_comments('20000000-0000-0000-0000-000000000701');
 if not c.is_mine or c.first_name<>'Amina' then raise exception 'Public first-name / owner contract'; end if;
 perform public.edit_event_comment(c.id,'Edited comment',c.updated_at);
 begin perform public.edit_event_comment(c.id,'Stale edit',c.updated_at); raise exception 'TEST: stale edit accepted'; exception when insufficient_privilege then null; end;
 begin perform public.add_event_comment('20000000-0000-0000-0000-000000000701','Spam'); raise exception 'TEST: posting limit bypass'; exception when others then if SQLERRM like 'TEST:%' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000703',true);
do $$ declare c record; begin
 select * into c from public.get_event_comments('20000000-0000-0000-0000-000000000701');
 if c.is_mine then raise exception 'Cross-account owner flag'; end if;
 begin perform public.remove_event_comment(c.id,c.updated_at); raise exception 'TEST: cross-account delete accepted'; exception when insufficient_privilege then null; end;
 begin perform public.edit_event_comment(c.id,'Other user edit',c.updated_at); raise exception 'TEST: cross-account edit accepted'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000701',true);
select public.remove_event_comment(id,updated_at) from public.get_event_comments('20000000-0000-0000-0000-000000000701');
do $$ begin if exists(select 1 from public.get_event_comments('20000000-0000-0000-0000-000000000701')) then raise exception 'Removed comment visible'; end if; end $$;
reset role;
do $$ begin if not exists(select 1 from public.event_comments where body='[Removed by author]' and hidden and first_name='Student') then raise exception 'Removal did not preserve redacted report target'; end if; end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000702',true);
insert into storage.objects(id,bucket_id,name) values ('70000000-0000-0000-0000-000000000702','product-originals','10000000-0000-0000-0000-000000000702/master.webp');
do $$ begin if (select count(*) from storage.objects)<>1 then raise exception 'Owner cannot read own private original'; end if; end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000701',true);
do $$ begin
 if exists(select 1 from storage.objects) then raise exception 'Cross-owner private file metadata'; end if;
 begin insert into storage.objects(id,bucket_id,name) values(gen_random_uuid(),'product-originals','10000000-0000-0000-0000-000000000702/attack.webp'); raise exception 'TEST: cross-owner upload accepted'; exception when insufficient_privilege then null; end;
 delete from storage.objects where bucket_id='product-originals';
 if found then raise exception 'Cross-owner file delete'; end if;
end $$;
reset role;
set local role anon;
do $$ begin if not exists(select 1 from public.public_vendor_previews where slug='legacy-release') then raise exception 'Legitimate public preview broken'; end if; end $$;
reset role;
rollback;
