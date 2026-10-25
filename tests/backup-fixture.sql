-- Disposable-only synthetic backup sentinel; never run against production.
insert into auth.users(id,email) values('90000000-0000-0000-0000-000000000001','backup@example.invalid');
insert into public.profiles(id,full_name) values('90000000-0000-0000-0000-000000000001','Synthetic Backup Sentinel');
