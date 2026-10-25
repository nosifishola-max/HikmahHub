-- Disposable database fixtures only; rolled back even on success.
begin;
insert into auth.users(id,email) values
('00000000-0000-0000-0000-000000000001','student@example.invalid'),
('00000000-0000-0000-0000-000000000002','admin@example.invalid'),
('00000000-0000-0000-0000-000000000003','vendor@example.invalid');
insert into public.profiles(id,full_name,role,matric_number,faculty,department) values
('00000000-0000-0000-0000-000000000001','Amina Private Family','student','ahu/001','Science','Computing'),
('00000000-0000-0000-0000-000000000002','Admin User','admin',null,null,null),
('00000000-0000-0000-0000-000000000003','Legacy Vendor','vendor',null,null,null);
-- Insert legacy vendor before checking trigger semantics by disabling only new validation locally.
alter table public.vendors disable trigger require_vendor_identity;
insert into public.vendors(id,owner_id,store_name,slug,whatsapp_number,status) values
('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000003','Legacy store','legacy','2348012345678','approved');
alter table public.vendors enable trigger require_vendor_identity;
insert into public.events(id,title,slug,starts_at,status) values
('20000000-0000-0000-0000-000000000001','Local event','local-event',now(),'published'),
('20000000-0000-0000-0000-000000000002','Draft event','draft-event',now(),'draft');
set local role anon;
do $$ begin
 begin if exists(select 1 from public.profiles) then raise exception 'Private profiles exposed'; end if; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.set_event_like('20000000-0000-0000-0000-000000000001',true);
select public.set_event_like('20000000-0000-0000-0000-000000000001',true);
select public.add_event_comment('20000000-0000-0000-0000-000000000001','Hello campus');
do $$ begin
 if (select like_count from public.get_event_likes('20000000-0000-0000-0000-000000000001')) <> 1 then raise exception 'Like idempotency'; end if;
 if (select first_name from public.event_comments limit 1) <> 'Amina' then raise exception 'Full name exposure'; end if;
 if (select count(*) from public.profiles) <> 1 then raise exception 'Profile privacy'; end if;
 begin perform public.set_event_like('20000000-0000-0000-0000-000000000002',true); raise exception 'TEST: draft event accepted'; exception when others then if SQLERRM like 'TEST:%' then raise; end if; end;
 begin perform public.admin_set_featured(gen_random_uuid(),true); raise exception 'TEST: admin action accepted'; exception when others then if SQLERRM like 'TEST:%' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
update public.vendors set description='Legacy access retained' where slug='legacy';
do $$ begin if not exists(select 1 from public.vendors where slug='legacy' and description='Legacy access retained') then raise exception 'Legacy access lost'; end if; end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
do $$ begin if not public.is_admin() then raise exception 'Admin access lost'; end if; end $$;
reset role;
do $$ begin
 begin
  update public.profiles set matric_number=' Ahu / 001 ' where id='00000000-0000-0000-0000-000000000003';
  raise exception 'TEST: normalized duplicate accepted';
 exception when unique_violation then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
insert into public.reports(reporter_id,target_type,target_id,reason)
select '00000000-0000-0000-0000-000000000001','event_comment',id,'inappropriate' from public.event_comments limit 1;
do $$ begin
 begin
  insert into public.reports(reporter_id,target_type,target_id,reason,status) values
  ('00000000-0000-0000-0000-000000000001','event', '20000000-0000-0000-0000-000000000001','other','resolved');
  raise exception 'TEST: forged moderation accepted';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select public.admin_resolve_report(id,'resolved',true) from public.reports where target_type='event_comment';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$ begin if exists(select 1 from public.event_comments) then raise exception 'Hidden comment visible'; end if; end $$;
reset role;
rollback;
