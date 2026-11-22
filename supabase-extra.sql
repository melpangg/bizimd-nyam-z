-- Bu dosyayı ana SQL şemasından SONRA bir kez çalıştırın.
-- Mevcut RLS politikalarına dokunmadan authenticated rolüne SELECT yetkisi verir.
grant select on table public.site_members to authenticated;

-- Ortak yapılacaklar: üyeler ekleyebilir ve tamamlandı durumunu değiştirebilir.
drop policy if exists "Members add todos" on public.todos;
create policy "Members add todos"
on public.todos for insert
to authenticated
with check (public.is_site_member() and created_by = auth.uid());

drop policy if exists "Members update todos" on public.todos;
create policy "Members update todos"
on public.todos for update
to authenticated
using (public.is_site_member())
with check (public.is_site_member());

-- Fotoğraf Storage bucket'ı Dashboard > Storage bölümünde love-photos adıyla
-- Public olarak oluşturulduktan sonra aşağıdaki politikaları çalıştırın.
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

drop policy if exists "Members delete own love photos storage" on storage.objects;
create policy "Members delete own love photos storage"
on storage.objects for delete
to authenticated
using (bucket_id = 'love-photos' and owner = auth.uid());


-- Günlük özlem kaydı: aynı gün yeniden kaydedildiğinde kişinin kendi kaydını güncelleyebilmesi.
drop policy if exists "Members update own moods" on public.daily_moods;
create policy "Members update own moods"
on public.daily_moods for update
to authenticated
using (public.is_site_member() and user_id = auth.uid())
with check (public.is_site_member() and user_id = auth.uid());

-- Çiçeği güvenli biçimde sulama: kullanıcı flower_state tablosunu doğrudan değiştiremez.
-- Uygulama bu fonksiyonu çağırır; fonksiyon üye kontrolü yapar ve çiçeği bir gün büyütür.
create or replace function public.water_love_flower()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_site_member() then
    raise exception 'Bu işlem için site üyesi olmalısınız.';
  end if;

  insert into public.flower_waterings (watered_by, watered_on)
  values (auth.uid(), current_date)
  on conflict (watered_on) do nothing;

  if not found then
    raise exception 'Bugün çiçek zaten sulandı.';
  end if;

  update public.flower_state
  set growth_days = least(growth_days + 1, 10),
      last_watered = current_date,
      wilted = false,
      updated_at = now()
  where id = 1;
end;
$$;

grant execute on function public.water_love_flower() to authenticated;
