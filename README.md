# MatchRating

Kullanıcıların takım kurup arkadaşlarını davet ettiği, birbirlerini 6
futbol yeteneği üzerinden oyladığı ve bu oylara göre rastgele + dengeli
takımlar oluşturulan basit bir demo.

## Teknoloji

- Next.js 14 (App Router, TypeScript)
- Vercel Postgres (`@vercel/postgres`)
- Kendi yazdığımız basit auth: bcrypt + JWT (httpOnly cookie), üçüncü parti
  auth servisi yok.

## Yerelde Kurulum

1. `npm install`
2. Vercel projesine **Storage > Postgres** ekle (yoksa `vercel storage create`
   veya Vercel Dashboard üzerinden). Sonra:
   ```
   vercel link
   vercel env pull .env.local
   ```
   Bu, `POSTGRES_URL` ve ilgili değişkenleri `.env.local` dosyasına yazar.
3. `.env.local` dosyasına ayrıca bir `JWT_SECRET` ekle:
   ```
   JWT_SECRET=$(openssl rand -base64 32)
   ```
4. Veritabanı şemasını oluştur:
   ```
   npm run db:init
   ```
5. `npm run dev` ile çalıştır, `http://localhost:3000`.

## Vercel'e Deploy

1. `vercel` (ilk deploy) veya GitHub reposunu Vercel'e bağla.
2. Proje ayarlarında **Storage > Postgres** eklenmiş olmalı (env değişkenleri
   otomatik eklenir).
3. **Settings > Environment Variables** kısmına `JWT_SECRET` ekle (Production
   ve Preview için).
4. `npm run db:init` komutunu bir kere prod veritabanına karşı çalıştır
   (yerelden `vercel env pull .env.local` ile prod bilgilerini çekip
   çalıştırabilirsin, ya da Vercel Postgres'in query arayüzünden
   `lib/schema.sql` içeriğini elle çalıştırabilirsin).
5. Deploy tamamlandığında site hazır.

## Akış

1. Kullanıcı kayıt olur / giriş yapar.
2. Dashboard'da yeni takım oluşturur (bir davet kodu üretilir) ya da başka
   birinin davet koduyla mevcut bir takıma katılır.
3. Takım sayfasında üyeler, davet kodu ve güncel yetenek puanları görünür.
4. "Oylama Yap" sayfasında her üye, diğer tüm üyeleri Şut / Pas / Dribling /
   Hız / Fizik / Defans için 1-10 arası puanlar. Oylar `votes` tablosunda
   (grup, oy veren, oylanan, yetenek) bazında tutulur; tekrar oylarsa güncellenir.
5. "Takımları Oluştur" sayfasında istenen takım sayısı girilir; sistem her
   oyuncunun aldığı oylardan ortalama gücünü hesaplar, oyuncuları rastgele
   karıştırıp toplam güce göre takımlara dengeli dağıtır (greedy balancing).
   Hiç oy almamış oyuncular nötr puan (5) ile hesaba katılır. Sonuç
   kaydedilmez, her tıklamada yeniden hesaplanır.

## Notlar / Sonraki Adımlar

- Basitlik için e-posta doğrulama / şifre sıfırlama yok.
- Takım kurucusu (owner) şu an üyeleri çıkaramıyor; istenirse eklenir.
- Oluşturulan takımlar şu an kaydedilmiyor (sadece gösteriliyor); geçmiş
  tutmak istenirse `team_generations` tablosu eklenebilir.
