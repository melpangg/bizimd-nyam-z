-- DRAFT ONLY: this file has not been run against Supabase.
-- Coupon permissions are handled by supabase-love-coupons.sql.
-- Do not restore the older all-members coupon INSERT/UPDATE policies.

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename in ('coupons', 'photos'))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'love-photos';

-- Expected app columns:
-- coupons: id, emoji, title, description, active, redeemed_at, created_at
-- photos: id, uploaded_by, storage_path, caption, created_at
-- Do not run until those columns and the existing policies are verified.

alter table public.photos enable row level security;

grant select, insert on table public.photos to authenticated;

do $$
declare
  sequence_name regclass;
begin
  sequence_name := pg_get_serial_sequence('public.photos', 'id')::regclass;
  if sequence_name is not null then
    execute format('grant usage, select on sequence %s to authenticated', sequence_name);
  end if;
end;
$$;

drop policy if exists "Site members view photos" on public.photos;
create policy "Site members view photos"
on public.photos for select
to authenticated
using (public.is_site_member());

drop policy if exists "Members add own photo records" on public.photos;
create policy "Members add own photo records"
on public.photos for insert
to authenticated
with check (
  public.is_site_member()
  and uploaded_by = auth.uid()
  and storage_path like (auth.uid()::text || '/%')
);

-- These Storage policies already appear in supabase-extra.sql.
-- Reapplying them does not grant access to non-members.
drop policy if exists "Members view love photos storage" on storage.objects;
create policy "Members view love photos storage"
on storage.objects for select
to authenticated
using (bucket_id = 'love-photos' and public.is_site_member());

drop policy if exists "Members upload love photos storage" on storage.objects;
create policy "Members upload love photos storage"
on storage.objects for insert
to authenticated
with check (bucket_id = 'love-photos' and public.is_site_member());

-- The current UI uses getPublicUrl(), so love-photos must remain a Public bucket.
-- Public buckets allow anyone with an object URL to fetch that image.
