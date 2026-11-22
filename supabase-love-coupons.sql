-- DRAFT ONLY. No SQL in this file has been run against Supabase.
-- The schema, existing policies, UNIQUE constraint, and FK behavior below
-- were supplied by the user and are deliberately preserved.
--
-- Verified:
--   coupons(id uuid, title text, description text, active boolean, created_at timestamptz)
--   coupon_redemptions(id uuid, coupon_id uuid, user_id uuid,
--                      redeemed_on date, created_at timestamptz)
--   UNIQUE(coupon_id, user_id, redeemed_on)
--   coupon_redemptions_coupon_id_fkey ON DELETE CASCADE
--   Existing RLS policies remain in place; no policies or constraints are dropped.
--
-- Existing coupons and redemption rows are not backfilled, updated, or deleted.
-- Coupons with any pre-existing redemption row are excluded from the new RPC,
-- so only previously unused coupons can enter the 24-hour cleanup window.

-- Read-only preflight: current effective table and column grants.
select grantee, table_name, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('coupons', 'coupon_redemptions')
order by table_name, grantee, privilege_type;

select grantee, table_name, column_name, privilege_type, is_grantable
from information_schema.role_column_grants
where table_schema = 'public'
  and table_name in ('coupons', 'coupon_redemptions')
order by table_name, grantee, column_name, privilege_type;

-- Read-only preflight: RLS state.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('coupons', 'coupon_redemptions');

-- Read-only preflight: pg_cron. Use dynamic SQL so this check is safe when the
-- extension (and therefore the cron schema) is not installed.
select extname, extnamespace::regnamespace as extension_schema
from pg_extension
where extname = 'pg_cron';

do $$
declare
  existing_job record;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for existing_job in execute
      'select jobid, jobname, schedule, command, active, username
       from cron.job
       where jobname = ''delete-expired-love-coupons'''
    loop
      raise notice 'Existing coupon cleanup job: %', row_to_json(existing_job);
    end loop;
  else
    raise notice 'pg_cron is not installed; no existing cleanup job to inspect.';
  end if;
end;
$$;

-- Read-only preflight: Realtime publication and its current table membership.
select pubname, puballtables, pubinsert, pubupdate, pubdelete
from pg_publication
where pubname = 'supabase_realtime';

select pubname, schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in ('coupons', 'coupon_redemptions')
order by tablename;

-- ---------------------------------------------------------------------------
-- CHANGE SECTION: run only after reviewing the preflight results.
-- Does not change existing RLS policies, UNIQUE constraints, or foreign keys.
-- Run as the database owner (Supabase SQL Editor) so the SECURITY DEFINER RPC
-- can write the redemption row while direct client INSERT remains unavailable.

begin;

alter table public.coupons
  add column if not exists emoji text not null default '💗',
  -- This column is introduced by this migration; it is absent from the
  -- currently verified schema and remains NULL for all legacy coupons.
  add column if not exists redeemed_at timestamptz;

-- Members may read coupons. The existing Admin manages coupons policy remains
-- responsible for restricting INSERT/UPDATE (including soft-delete) to Emre.
revoke all on table public.coupons from public, anon;
grant select on table public.coupons to authenticated;
grant insert (emoji, title, description, active) on table public.coupons to authenticated;
grant update (emoji, title, description, active) on table public.coupons to authenticated;

-- Keep the existing Members view redemptions policy, but prevent direct client
-- writes. New usage rows are written only by redeem_love_coupon().
revoke all on table public.coupon_redemptions from public, anon;
revoke insert, update, delete on table public.coupon_redemptions
  from public, anon, authenticated;
grant select on table public.coupon_redemptions to authenticated;

create or replace function public.redeem_love_coupon(coupon_id_text text)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_coupon public.coupons%rowtype;
  redemption_time timestamptz;
begin
  if auth.uid() is null or not public.is_site_member() then
    raise exception 'Bu işlem yalnızca site üyelerine açıktır.'
      using errcode = '42501';
  end if;

  select *
    into selected_coupon
  from public.coupons
  where id = coupon_id_text::uuid
  for update;

  if not found or selected_coupon.active is distinct from true then
    raise exception 'Bu kupon artık kullanılamıyor.'
      using errcode = 'P0001';
  end if;

  if selected_coupon.redeemed_at is not null then
    raise exception 'Bu kupon daha önce kullanıldı.'
      using errcode = 'P0001';
  end if;

  -- Legacy redemption rows must remain untouched. Excluding these coupons
  -- also ensures the cleanup job cannot cascade-delete their history.
  if exists (
    select 1
    from public.coupon_redemptions redemption
    where redemption.coupon_id = selected_coupon.id
  ) then
    raise exception 'Bu kupon eski kullanım kayıtlarına sahip ve yeniden kullanılamaz.'
      using errcode = 'P0001';
  end if;

  redemption_time := clock_timestamp();

  update public.coupons
  set redeemed_at = redemption_time
  where id = selected_coupon.id
    and redeemed_at is null;

  if not found then
    raise exception 'Bu kupon daha önce kullanıldı.'
      using errcode = 'P0001';
  end if;

  -- Preserve the existing per-user/per-day UNIQUE constraint. The locked
  -- coupons row and redeemed_at transition enforce one shared use across both
  -- members, including concurrent requests.
  insert into public.coupon_redemptions (coupon_id, user_id, redeemed_on)
  values (selected_coupon.id, auth.uid(), current_date)
  on conflict (coupon_id, user_id, redeemed_on) do nothing;

  return redemption_time;
end;
$$;

revoke all on function public.redeem_love_coupon(text) from public, anon;
grant execute on function public.redeem_love_coupon(text) to authenticated;

create or replace function public.delete_expired_love_coupons()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.coupon_redemptions redemption
  using public.coupons coupon
  where redemption.coupon_id = coupon.id
    and coupon.redeemed_at <= clock_timestamp() - interval '24 hours';

  delete from public.coupons
  where redeemed_at <= clock_timestamp() - interval '24 hours';
end;
$$;

revoke all on function public.delete_expired_love_coupons() from public, anon, authenticated;

commit;


-- Safe pg_cron setup: do not fail if the extension is unavailable.
do $$
declare
  cron_schema text;
  existing_job_id bigint;
begin
  select n.nspname
  into cron_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pg_cron';

  if cron_schema is null then
    raise notice 'pg_cron is not installed. Enable it from Supabase Dashboard > Database > Extensions.';
    return;
  end if;

  for existing_job_id in
    execute format(
      'select jobid from %I.job where jobname = $1',
      cron_schema
    )
    using 'delete-expired-love-coupons'
  loop
    execute format(
      'select %I.unschedule($1)',
      cron_schema
    ) using existing_job_id;
  end loop;

  execute format(
    'select %I.schedule($1, $2, $3)',
    cron_schema
  )
  using
    'delete-expired-love-coupons',
    '* * * * *',
    'select public.delete_expired_love_coupons()';

  raise notice 'Love coupon cleanup job scheduled successfully.';
end;
$$;

-- Idempotently add both tables to the existing Supabase Realtime publication.
do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    raise exception 'Publication supabase_realtime does not exist.';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'coupons'
  ) then
    execute 'alter publication supabase_realtime add table public.coupons';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'coupon_redemptions'
  ) then
    execute 'alter publication supabase_realtime add table public.coupon_redemptions';
  end if;
end;
$$;
