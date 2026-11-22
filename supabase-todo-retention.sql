-- Taslak: bu dosya Supabase'de calistirilmadi.
-- public.todos.completed_at mevcut uygulama tarafindan kullaniliyor.
-- Yalnizca 7 gunden eski tamamlanmis gorevleri siler; tamamlanmamis
-- gorevlere ve diger tablolara dokunmaz.
-- Supabase SQL Editor'de tablo sahibi olan postgres roluyle calistirin;
-- istemci DELETE izni veya yeni bir RLS politikasi eklemez.

create extension if not exists pg_cron;

select cron.schedule(
  'delete-completed-todos-after-7-days',
  '*/15 * * * *',
  $job$
    delete from public.todos
    where completed is true
      and completed_at is not null
      and completed_at <= now() - interval '7 days';
  $job$
);
