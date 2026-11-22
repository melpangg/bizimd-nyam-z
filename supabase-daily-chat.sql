-- Taslak: bu dosya Supabase'de calistirilmadi.
-- Mevcut tablolara dokunmadan gunluk sohbet icin yeni bir tablo olusturur.
-- Sohbet gunu Europe/Istanbul saat diliminde 00.00'da degisir.

begin;

create table public.daily_chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_date date not null default ((now() at time zone 'Europe/Istanbul')::date),
  sender_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  body text not null
    check (body ~ '[^[:space:]]' and char_length(body) <= 2000),
  created_at timestamptz not null default now()
);

create index daily_chat_messages_date_time_idx
  on public.daily_chat_messages (chat_date, created_at, id);

alter table public.daily_chat_messages enable row level security;

revoke all on table public.daily_chat_messages from PUBLIC, anon, authenticated;
grant select on table public.daily_chat_messages to authenticated;
grant insert (body) on table public.daily_chat_messages to authenticated;

create policy "Site members read daily chat"
  on public.daily_chat_messages for select
  to authenticated
  using (public.is_site_member());

create policy "Site members send daily chat"
  on public.daily_chat_messages for insert
  to authenticated
  with check (
    public.is_site_member()
    and sender_id = auth.uid()
    and chat_date = (now() at time zone 'Europe/Istanbul')::date
  );

commit;
