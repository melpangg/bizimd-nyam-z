# Elif & Emre Love — Next.js + Supabase

Bu klasör, Elif ve Emre için hazırlanan web sitesinin başlangıç projesidir.

## 1. Gerekli program
- Node.js LTS
- VS Code (önerilir)

## 2. Projeyi çalıştırma
Terminali bu klasörde açın ve sırayla çalıştırın:

```bash
npm install
npm run dev
```

Tarayıcıda http://localhost:3000 adresini açın.

## 3. Supabase bağlantısı
`.env.example` içindeki değişkenleri `.env.local` dosyanıza ekleyin:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SITE_LOGIN_PIN=1101
```

Publishable key tarayıcıda kullanılabilir. `SUPABASE_SERVICE_ROLE_KEY` yalnızca sunucu tarafında kullanılmalıdır; `NEXT_PUBLIC_` öneki eklemeyin ve anahtarı istemci koduna koymayın. PIN sunucu tarafında doğrulanır. PIN ekranından sonra seçilen `Elif` veya `Emre` üyesi `site_members.display_name` üzerinden bulunur ve mevcut Supabase Auth kullanıcısı için oturum oluşturulur. E-posta veya Supabase parolası istenmez.
Üye tablosundaki `display_name` değerleri bu akış için tam olarak `Elif` ve `Emre` olmalıdır.

PIN paylaşılan ve kısa bir kod olduğu için güçlü, kişiye özel kimlik doğrulamanın yerini tutmaz. Uygulama sunucu örneği başına kısa süreli deneme sınırı uygular; herkese açık dağıtımlarda ayrıca platform veya paylaşımlı bir servis üzerinden IP bazlı istek sınırlaması kullanın.

## 5. Veritabanı
Önceki adımda SQL Editor'de oluşturduğunuz tablolar kullanılır:
`site_members`, `daily_moods`, `flower_state`, `flower_waterings`, `photos`, `daily_messages`, `coupons`, `coupon_redemptions`, `todos`, `love_events`.

**Önemli:** Mevcut SQL politikalarınız üyelerin `todos` tablosuna ekleme/güncelleme yapmasına izin vermiyor. `supabase-extra.sql` dosyasındaki ek politikaları/fonksiyonları bir kez çalıştırın. Bu dosya ortak yapılacaklar, günlük özlem kaydını güncelleme ve güvenli çiçek sulama işlemlerini tamamlar.

## 6. Fotoğraf albümü
Supabase Dashboard > Storage bölümünden `love-photos` adında bir bucket oluşturun ve Public olarak ayarlayın. Ardından `supabase-extra.sql` içindeki Storage politikalarını çalıştırın. Yükleme boyutunu makul tutun.

## 7. Özellikler
- Sunucuda doğrulanan PIN ve Emre/Elif üye seçimiyle giriş
- Mevcut Supabase Auth kullanıcıları üzerinden kalıcı oturum; roller ve RLS politikaları korunur
- Günlük 1–10 özlem kaydı ve not
- Çiçek durumu ve günlük sulama
- Günlük sevgi mesajı
- Ortak yapılacaklar listesi
- Aşk kuponları (Emre ekler/yönetir; Elif ve Emre kullanabilir)
- Fotoğraf albümü
- Yalnız admin rolündeki Emre için yönetici alanı

Kuponların ortak kullanım durumu, 24 saat sonra otomatik silinmesi, RLS ve Realtime ayarları için `supabase-love-coupons.sql` taslağı hazırlanmıştır. Dosyanın önce salt okunur inceleme sorgularını çalıştırıp sonuçları doğrulayın; değişiklik bölümü henüz Supabase'de uygulanmamıştır. Otomatik silme için `pg_cron` gerekir.

Not: Bu bir başlangıç sürümüdür. Çiçeğin 10 gün sonunda otomatik açması/kaçırılan sulamada otomatik solması için zamanlanmış sunucu görevi (cron/Edge Function) eklenmelidir. Bu sürümde sulama ve yönetici gübreleme işlemleri elle tetiklenir. AI tarafından otomatik not üretimi için ayrıca güvenli bir sunucu API entegrasyonu gerekir.
