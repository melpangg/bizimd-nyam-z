-- DRAFT ONLY: this migration has not been run against Supabase.
-- Run only after reviewing and deploying the cleanup Edge Function.
-- This migration does not delete existing photo rows or Storage objects.
-- It does not change existing public.photos RLS policies.

begin;

-- Existing rows receive a migration grace period of 24 hours from migration time.
-- New application uploads set expires_at explicitly to 24 hours after upload.
alter table public.photos
  add column if not exists expires_at timestamptz
    not null default (clock_timestamp() + interval '24 hours');

create index if not exists photos_expires_at_idx
  on public.photos (expires_at);

-- Restrict bucket access and enforce upload limits at the Storage boundary.
update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif'
    ]::text[]
where id = 'love-photos';

commit;

-- Server-side cleanup schedule. The Edge Function performs Storage deletion
-- and database deletion using the server-only service role.
-- Before running this section:
--   1. Deploy supabase/functions/cleanup-expired-photos/index.ts.
--   2. Set PHOTO_CLEANUP_SECRET in Edge Function environment variables.
--   3. Store these Vault secrets:
--      photo_cleanup_url: https://<project-ref>.supabase.co/functions/v1/cleanup-expired-photos
--      photo_cleanup_secret: the same secret configured in the Edge Function

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  cron_schema text;
  existing_job_id bigint;
  cleanup_url text;
  cleanup_secret text;
begin
  select n.nspname
  into cron_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pg_cron';

  if cron_schema is null then
    raise notice 'pg_cron is not available. Enable it before scheduling photo cleanup.';
    return;
  end if;

  cleanup_url := coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'photo_cleanup_url' limit 1),
    ''
  );
  cleanup_secret := coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'photo_cleanup_secret' limit 1),
    ''
  );

  if cleanup_url = '' or cleanup_secret = '' then
    raise notice 'Photo cleanup is not scheduled: configure photo_cleanup_url and photo_cleanup_secret in Supabase Vault.';
    return;
  end if;

  for existing_job_id in
    execute format(
      'select jobid from %I.job where jobname = $1',
      cron_schema
    )
    using 'delete-expired-love-photos'
  loop
    execute format('select %I.unschedule($1)', cron_schema)
    using existing_job_id;
  end loop;

  execute format(
    'select %I.schedule($1, $2, $3)',
    cron_schema
  )
  using
    'delete-expired-love-photos',
    '* * * * *',
    format(
      $cron$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || %L,
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      );
      $cron$,
      cleanup_url,
      cleanup_secret
    );
end;
$$;
