-- Schema-only production Storage policies captured read-only 2026-10-28.
-- PostgreSQL metadata harness, not the Storage HTTP API or object bytes.
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select,insert,update,delete on storage.objects to authenticated;
create policy "vendor writes own product images" on storage.objects for INSERT to "authenticated"  with check (((bucket_id = 'product-images'::text) AND owns_approved_vendor(((storage.foldername(name))[1])::uuid)));
create policy "vendor updates own product images" on storage.objects for UPDATE to "authenticated" using (((bucket_id = 'product-images'::text) AND owns_approved_vendor(((storage.foldername(name))[1])::uuid))) ;
create policy "vendor deletes own product images" on storage.objects for DELETE to "authenticated" using (((bucket_id = 'product-images'::text) AND owns_vendor(((storage.foldername(name))[1])::uuid))) ;
create policy "vendor writes own logo" on storage.objects for INSERT to "authenticated"  with check (((bucket_id = 'vendor-logos'::text) AND owns_vendor(((storage.foldername(name))[1])::uuid)));
create policy "vendor updates own logo" on storage.objects for UPDATE to "authenticated" using (((bucket_id = 'vendor-logos'::text) AND owns_vendor(((storage.foldername(name))[1])::uuid))) ;
create policy "vendor deletes own logo" on storage.objects for DELETE to "authenticated" using (((bucket_id = 'vendor-logos'::text) AND owns_vendor(((storage.foldername(name))[1])::uuid))) ;
create policy "admin manages event images" on storage.objects for ALL to "authenticated" using (((bucket_id = 'event-images'::text) AND is_admin())) with check (((bucket_id = 'event-images'::text) AND is_admin()));
create policy "admin manages all images" on storage.objects for ALL to "authenticated" using (((bucket_id = ANY (ARRAY['product-images'::text, 'vendor-logos'::text])) AND is_admin())) with check (((bucket_id = ANY (ARRAY['product-images'::text, 'vendor-logos'::text])) AND is_admin()));
create policy "vendor writes own originals" on storage.objects for INSERT to "authenticated"  with check (((bucket_id = 'product-originals'::text) AND owns_approved_vendor(((storage.foldername(name))[1])::uuid)));
create policy "vendor reads own originals" on storage.objects for SELECT to "authenticated" using (((bucket_id = 'product-originals'::text) AND owns_vendor(((storage.foldername(name))[1])::uuid))) ;
create policy "vendor deletes own originals" on storage.objects for DELETE to "authenticated" using (((bucket_id = 'product-originals'::text) AND owns_vendor(((storage.foldername(name))[1])::uuid))) ;
create policy "admin manages originals" on storage.objects for ALL to "authenticated" using (((bucket_id = 'product-originals'::text) AND is_admin())) with check (((bucket_id = 'product-originals'::text) AND is_admin()));
create policy "admin manages promo banners" on storage.objects for ALL to "authenticated" using (((bucket_id = 'promo-banners'::text) AND is_admin())) with check (((bucket_id = 'promo-banners'::text) AND is_admin()));

