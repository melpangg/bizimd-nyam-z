-- DRAFT ONLY: this migration has not been run against Supabase.
-- Creates private, explicitly saved memories for the existing Elif account.
-- No existing tables, policies, or rows are changed.

-- Read-only preflight: verify the existing membership table and its policies.
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'site_members'
order by ordinal_position;

select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'site_members'
order by policyname;

begin;

create table public.strawberry_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('memory', 'settings')),
  content text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint strawberry_memories_content_shape check (
    (
      kind = 'memory'
      and content is not null
      and char_length(btrim(content)) between 1 and 500
      and enabled is true
    )
    or (kind = 'settings' and content is null)
  )
);

create index strawberry_memories_user_created_idx
  on public.strawberry_memories (user_id, created_at desc)
  where kind = 'memory';

create unique index strawberry_memories_one_settings_per_user_idx
  on public.strawberry_memories (user_id)
  where kind = 'settings';

alter table public.strawberry_memories enable row level security;

revoke all on table public.strawberry_memories from public, anon, authenticated;
grant select, insert, update, delete on table public.strawberry_memories to authenticated;

create policy "Elif manages own strawberry memories"
  on public.strawberry_memories for all
  to authenticated
  using (
    user_id = auth.uid()
    and auth.uid() = '921dbc15-2c03-4898-adcf-ca40638efcc1'::uuid
    and public.is_site_member()
    and exists (
      select 1
      from public.site_members member
      where member.user_id = auth.uid()
        and member.display_name = 'Elif'
    )
  )
  with check (
    user_id = auth.uid()
    and auth.uid() = '921dbc15-2c03-4898-adcf-ca40638efcc1'::uuid
    and public.is_site_member()
    and exists (
      select 1
      from public.site_members member
      where member.user_id = auth.uid()
        and member.display_name = 'Elif'
    )
  );

commit;
