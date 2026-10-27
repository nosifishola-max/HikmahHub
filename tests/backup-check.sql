do $$ begin
 if not exists(select 1 from public.profiles where id='90000000-0000-0000-0000-000000000001' and full_name='Synthetic Backup Sentinel')
 or not exists(select 1 from auth.users where id='90000000-0000-0000-0000-000000000001' and email='backup@example.invalid')
 then raise exception 'Backup sentinel was not restored'; end if;
end $$;
