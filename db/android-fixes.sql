-- Unapplied draft. Run AFTER v1_1.sql, only with separate production approval.
begin;
create function public.ensure_my_profile() returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='28000'; end if;
 -- The authenticated auth.users row is authoritative; never accept a caller-supplied id/role.
 insert into public.profiles(id,email,full_name)
 select u.id,u.email,left(coalesce(u.raw_user_meta_data->>'full_name',''),120)
 from auth.users u where u.id=auth.uid()
 on conflict(id) do nothing;
 if not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'Account unavailable'; end if;
end $$;
revoke all on function public.ensure_my_profile() from public,anon;
grant execute on function public.ensure_my_profile() to authenticated;
create function private.ensure_owned_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or new.user_id <> auth.uid() then raise exception 'Sign in as the record owner' using errcode='42501'; end if;
 perform public.ensure_my_profile(); return new;
end $$;
revoke all on function private.ensure_owned_profile() from public,anon,authenticated;
create trigger ensure_demand_profile before insert on public.demand_requests for each row execute function private.ensure_owned_profile();
create trigger ensure_save_profile before insert on public.product_saves for each row execute function private.ensure_owned_profile();

create table public.academic_departments(faculty text not null,department text not null,primary key(faculty,department));
alter table public.academic_departments enable row level security;
revoke all on public.academic_departments from anon,authenticated;
grant select on public.academic_departments to authenticated;
create policy academics_read on public.academic_departments for select to authenticated using(true);
insert into public.academic_departments values ('Faculty of Agriculture','Agriculture'),
('Faculty of Education','Science Education'),
('Faculty of Education','Arts and Social Sciences Education'),
('Faculty of Education','Educational Management and Counselling'),
('Faculty of Basic Medical Sciences','Medical Laboratory Science'),
('Faculty of Basic Medical Sciences','Community Health'),
('Faculty of Basic Medical Sciences','Public Health'),
('Faculty of Basic Medical Sciences','Human Anatomy'),
('Faculty of Basic Medical Sciences','Human Physiology'),
('Faculty of Humanities and Social Sciences','Sociology and Criminology'),
('Faculty of Humanities and Social Sciences','Political Science and Public Administration'),
('Faculty of Humanities and Social Sciences','Mass Communication'),
('Faculty of Humanities and Social Sciences','Languages'),
('Faculty of Humanities and Social Sciences','Islamic Studies'),
('Faculty of Humanities and Social Sciences','History and International Studies'),
('Faculty of Law','Law'),
('Faculty of Management Sciences','Accounting'),
('Faculty of Management Sciences','Finance'),
('Faculty of Management Sciences','Banking and Finance'),
('Faculty of Management Sciences','Economics'),
('Faculty of Management Sciences','Business Administration'),
('Faculty of Natural and Applied Sciences','Chemical and Geological Sciences'),
('Faculty of Natural and Applied Sciences','Biological Sciences'),
('Faculty of Natural and Applied Sciences','Physical Sciences'),
('Faculty of Computing, Engineering and Technology','Computer Sciences'),
('Faculty of Computing, Engineering and Technology','Computer Science'),
('Faculty of Computing, Engineering and Technology','Data Science and Information Systems'),
('Faculty of Computing, Engineering and Technology','Data Science'),
('Faculty of Nursing Sciences','Nursing Science'),
('College of Health Sciences','Medicine and Surgery');
create function private.validate_profile_fields() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.full_name is distinct from old.full_name and (char_length(btrim(new.full_name)) not between 2 and 120 or new.full_name is null) then raise exception 'Full name must contain 2 to 120 characters'; end if;
 if new.matric_number is distinct from old.matric_number and nullif(new.matric_number,'') is not null and new.matric_number !~ '^[A-Z0-9/.-]{4,80}$' then raise exception 'Invalid matric number'; end if;
 if new.phone is distinct from old.phone and nullif(new.phone,'') is not null and new.phone !~ '^[0-9]{10,15}$' then raise exception 'Invalid phone'; end if;
 if new.level is distinct from old.level and nullif(new.level,'') is not null and new.level not in ('100','200','300','400','500','600') then raise exception 'Invalid level'; end if;
 -- Unchanged historical pairs remain valid, even if no longer in the catalogue.
 if new.faculty is distinct from old.faculty or new.department is distinct from old.department then
  if coalesce(new.faculty,'') <> '' or coalesce(new.department,'') <> '' then
   if not exists(select 1 from public.academic_departments a where a.faculty=new.faculty and a.department=new.department) then raise exception 'Choose a department belonging to the selected faculty'; end if;
  end if;
 end if;
 return new;
end $$;
revoke all on function private.validate_profile_fields() from public,anon,authenticated;
create trigger zz_validate_profile_fields before update on public.profiles for each row execute function private.validate_profile_fields();

-- Snapshot is captured at report insertion, so subsequent edits do not erase review context.
alter table public.reports add column content_snapshot jsonb;
create function private.report_content(p_type text,p_target uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare snapshot jsonb;
begin
 if p_type='product' then select jsonb_build_object('title',p.title,'vendor',v.store_name,'path','/shop/'||v.slug||'/'||p.slug) into snapshot from public.products p join public.vendors v on v.id=p.vendor_id where p.id=p_target;
 elsif p_type='store' then select jsonb_build_object('title',v.store_name,'vendor',v.store_name,'path','/shop/'||v.slug) into snapshot from public.vendors v where v.id=p_target;
 elsif p_type='deal' then select jsonb_build_object('title',p.title,'vendor',v.store_name,'path','/shop/'||v.slug||'/'||p.slug) into snapshot from public.campus_deals d join public.products p on p.id=d.product_id join public.vendors v on v.id=d.vendor_id where d.id=p_target;
 elsif p_type='event' then select jsonb_build_object('title',e.title,'path','/events/'||e.slug) into snapshot from public.events e where e.id=p_target;
 elsif p_type='event_comment' then select jsonb_build_object('title',c.body,'first_name',c.first_name,'path','/events/'||e.slug||'#comment-'||c.id) into snapshot from public.event_comments c join public.events e on e.id=c.event_id where c.id=p_target;
 end if;
 return snapshot;
end $$;
revoke all on function private.report_content(text,uuid) from public,anon,authenticated;
create function private.snapshot_report() returns trigger language plpgsql security definer set search_path='' as $$
begin new.content_snapshot=private.report_content(new.target_type,new.target_id); return new; end $$;
revoke all on function private.snapshot_report() from public,anon,authenticated;
create trigger snapshot_report before insert on public.reports for each row execute function private.snapshot_report();

create function public.admin_report_queue(p_limit integer default 50) returns setof public.reports
language plpgsql security definer set search_path='' as $$
declare r public.reports;
begin
 if not public.is_admin() then raise exception 'Admin only' using errcode='42501'; end if;
 for r in select * from public.reports order by created_at desc limit least(greatest(p_limit,1),100) loop
  if r.content_snapshot is null then r.content_snapshot=coalesce(private.report_content(r.target_type,r.target_id),'{}'::jsonb)||jsonb_build_object('historical_context',true); end if;
  return next r;
 end loop;
end $$;
revoke all on function public.admin_report_queue(integer) from public,anon;
grant execute on function public.admin_report_queue(integer) to authenticated;
create table public.moderation_templates(action text primary key,message text not null check(char_length(message) between 3 and 1000));
alter table public.moderation_templates enable row level security;
revoke all on public.moderation_templates from anon,authenticated;
grant select,insert,update,delete on public.moderation_templates to authenticated;
create policy moderation_templates_admin on public.moderation_templates for all to authenticated using((select public.is_admin())) with check((select public.is_admin()));
insert into public.moderation_templates values
('dismiss','Thank you for raising this concern. We reviewed the content and found no policy violation.'),
('request_changes','Please update the listing information so that its description, price and availability are accurate.'),
('reject_listing','Your listing could not be approved. Please correct the issues described in this review before resubmitting.'),
('hide_listing','Your listing has been hidden while we review a concern. Please contact HikmahHub with any supporting information.'),
('suspend_vendor','Your store has been suspended following a policy review. Please contact HikmahHub to discuss the next steps.'),
('reject_vendor','Your vendor application requires corrections. Please review the reason and resubmit your application.'),
('restore','This content has been reviewed and restored.'),
('hide_comment','This comment has been hidden after a moderation review.');
create function public.admin_moderate_report(p_report uuid,p_action text,p_reason text,p_expected text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.reports; v_id uuid; old_state text;
begin
 if not public.is_admin() then raise exception 'Admin only' using errcode='42501'; end if;
 if char_length(btrim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'A moderation reason is required'; end if;
 select * into r from public.reports where id=p_report for update;
 if r.id is null or r.status is distinct from p_expected then raise exception 'Report changed; refresh before reviewing'; end if;
 if r.status in ('resolved','dismissed') and p_action <> 'restore' then raise exception 'Already reviewed'; end if;
 if p_action='dismiss' then null;
 elsif r.target_type='product' then
  select vendor_id,status::text into v_id,old_state from public.products where id=r.target_id for update;
  if old_state is null then raise exception 'Reported listing is no longer available'; end if;
  if p_action='request_changes' then update public.products set review_note=p_reason where id=r.target_id;
  elsif p_action='reject_listing' then perform public.admin_review_product(r.target_id,'rejected',p_reason);
  elsif p_action='hide_listing' then perform public.admin_review_product(r.target_id,'hidden',p_reason);
  elsif p_action='suspend_vendor' then perform public.admin_set_vendor_status(v_id,'suspended',p_reason);
  elsif p_action='restore' and old_state='hidden' then perform public.admin_review_product(r.target_id,'approved',p_reason);
  else raise exception 'Action not permitted for this content'; end if;
 elsif r.target_type='store' then
  select status::text into old_state from public.vendors where id=r.target_id for update;
  if p_action='suspend_vendor' then perform public.admin_set_vendor_status(r.target_id,'suspended',p_reason);
  elsif p_action='reject_vendor' then perform public.admin_set_vendor_status(r.target_id,'rejected',p_reason);
  elsif p_action='restore' and old_state='suspended' then perform public.admin_set_vendor_status(r.target_id,'approved',p_reason);
  else raise exception 'Action not permitted for this vendor'; end if;
 elsif r.target_type='deal' then
  select status::text into old_state from public.campus_deals where id=r.target_id for update;
  if old_state is null then raise exception 'Reported deal is no longer available'; end if;
  if p_action not in ('hide_listing','reject_listing','restore') or (p_action='restore' and old_state not in ('hidden','rejected')) then raise exception 'Action not permitted for this deal'; end if;
  if old_state=(case when p_action='hide_listing' then 'hidden' when p_action='reject_listing' then 'rejected' else 'approved' end) then raise exception 'Deal already in this state'; end if;
  update public.campus_deals set status=case when p_action='hide_listing' then 'hidden'::public.moderation_status when p_action='reject_listing' then 'rejected'::public.moderation_status else 'approved'::public.moderation_status end where id=r.target_id;
 elsif r.target_type='event_comment' then
  if p_action not in ('hide_comment','restore') then raise exception 'Action not permitted'; end if;
  update public.event_comments set hidden=(p_action='hide_comment') where id=r.target_id and hidden is distinct from (p_action='hide_comment');
  if not found then raise exception 'Comment already in this state'; end if;
 elsif r.target_type='event' then
  if p_action not in ('hide_listing','restore') then raise exception 'Action not permitted'; end if;
  update public.events set status=case when p_action='restore' then 'published'::public.publish_status else 'cancelled'::public.publish_status end where id=r.target_id and status::text = case when p_action='restore' then 'cancelled' else 'published' end;
  if not found then raise exception 'Event already in this state'; end if;
 else raise exception 'Use the existing content review panel for this target'; end if;
 update public.reports set status=case when p_action='dismiss' then 'dismissed' else 'resolved' end,resolved_by=auth.uid(),resolved_at=now() where id=p_report;
 insert into public.admin_actions(admin_id,action,target_type,target_id,details) values(auth.uid(),p_action,r.target_type,r.target_id,jsonb_build_object('report',p_report,'reason',p_reason,'previous_report_status',r.status));
end $$;
revoke all on function public.admin_moderate_report(uuid,text,text,text) from public,anon;
grant execute on function public.admin_moderate_report(uuid,text,text,text) to authenticated;
commit;
