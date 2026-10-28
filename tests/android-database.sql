begin;
insert into auth.users(id,email,raw_user_meta_data) values('80000000-0000-0000-0000-000000000001','missing@example.invalid','{"full_name":"Amina Private Family"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-0000-0000-000000000001',true);
select public.ensure_my_profile();
do $$ begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='student') then raise exception 'Missing profile not repaired'; end if;
end $$;
insert into public.demand_requests(user_id,title) values(auth.uid(),'Need a calculator');
do $$ begin
 begin
 update public.profiles set faculty='Faculty of Law',department='Not a law department' where id=auth.uid();
 raise exception 'TEST: mismatched department accepted';
 exception when others then if SQLERRM not like '%department belonging%' then raise; end if; end;
 begin perform public.admin_moderate_report(gen_random_uuid(),'dismiss','No issue','open'); raise exception 'TEST: student moderation allowed';
 exception when insufficient_privilege then null; end;
end $$;
update public.profiles set faculty='Faculty of Law',department='Law',full_name='Amina Test',matric_number='26/01HUI001' where id=auth.uid();
reset role;
rollback;
