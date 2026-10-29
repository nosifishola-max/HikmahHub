-- REVIEW ONLY: apply only after verified database and Storage backups.
-- Customer-experience reviews are not purchase-verified: HikmahHub has no checkout evidence.
begin;
create table public.vendor_reviews (
 id uuid primary key default gen_random_uuid(),
 vendor_id uuid not null references public.vendors(id) on delete cascade,
 reviewer_id uuid not null references auth.users(id) on delete cascade,
 rating smallint not null check (rating between 1 and 5),
 comment text not null check (char_length(btrim(comment)) between 15 and 1000),
 status text not null default 'published' check (status in ('published','hidden')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (vendor_id, reviewer_id)
);
create index vendor_reviews_public_idx on public.vendor_reviews(vendor_id,created_at desc) where status='published';
alter table public.vendor_reviews enable row level security;
create policy "Anyone can read published reviews" on public.vendor_reviews for select to anon,authenticated using (status='published' or reviewer_id=(select auth.uid()) or public.is_admin());
create policy "Customers may submit their own review" on public.vendor_reviews for insert to authenticated
 with check (
 reviewer_id=(select auth.uid()) and status='published'
 and exists (select 1 from public.vendors v where v.id=vendor_id and v.status='approved' and v.owner_id<>(select auth.uid()))
 and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true)
 );
create policy "Customers may remove their own review" on public.vendor_reviews for delete to authenticated using (reviewer_id=(select auth.uid()));
-- No client update policy: changing ratings requires removing and re-submitting.
-- Moderators use an audited service-side process, not vendor-owned delete privileges.
grant select,insert,delete on public.vendor_reviews to authenticated;
grant select on public.vendor_reviews to anon;
commit;

