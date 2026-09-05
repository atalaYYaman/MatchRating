// Markanin TEK kaynagi. Isim ve alan adi ileride yine degisebilir; o yuzden
// kullaniciya gorunen her yerde bu dosya okunur, string gomulmez.
//
// Isim degistiginde: bu dosyayi ve mobile/lib/brand.ts'i guncelle, sonra
// `npm run brand:check` ile kacak kalmadigini dogrula.
//
// Alan adi ve gonderen adresi ORTAM DEGISKENINDEN okunur: yeni domain
// hazir oldugunda kod degistirip yeniden dagitmak gerekmesin, Vercel'de
// degiskeni guncellemek yetsin.
//
// DEGISTIRILMEYECEKLER (bilerek marka disinda tutuldu):
//   - storage anahtarlari (STORAGE_PREFIX): degisirse herkesin oturumu
//     kapanir ve takim kapsam secimi sifirlanir.
//   - mobil paket adi (com.otlak.matchrating) ve EAS slug'i: Play Store'da
//     yayinlandiktan sonra degistirilemez, slug degisirse OTA kirilir.

/** Yeni alan adi hazir olana kadar calisan adres burada kalir. */
const FALLBACK_URL = "https://otlak.xyz";

function appUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return (raw && raw.replace(/\/$/, "")) || FALLBACK_URL;
}

function domainOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

const url = appUrl();

export const brand = {
  /** Arayuzde gorunen isim. */
  name: "Panenka",
  /** Buyuk harfli kullanimlar (eyebrow, rozet). */
  nameUpper: "PANENKA",
  /** Kisa tanim; magaza ve meta aciklamalarinda. */
  tagline: "Halı saha takımın için puanlama ve denk kadro",
  /** Uzun aciklama. */
  description:
    "Arkadaş grubunla halı saha maçlarını planla, birbirinizi puanlayın ve " +
    "güce göre denk takımlar kurun.",
  /** Canli adres — NEXT_PUBLIC_APP_URL ile degistirilebilir. */
  url,
  domain: domainOf(url),
  /**
   * Kullanicilarin ulasabilecegi adres. NEXT_PUBLIC_ onekli, cunku bu
   * bilgi kullaniciya gosteriliyor ve client bilesenlerinden de okunmasi
   * gerekebiliyor; oneksiz olsaydi orada sessizce varsayilana duserdi.
   */
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "info@panenka.tr",
  /**
   * Giden e-postalarda gorunecek gonderen. YALNIZCA SUNUCU: bu deger
   * hicbir zaman kullaniciya gosterilmedigi icin NEXT_PUBLIC_ degil. Saglayicida DOGRULANMIS bir
   * alan adi olmali; yeni domain hazir olana kadar MAIL_FROM ile mevcut
   * dogrulanmis adres verilebilir.
   */
  mailFrom: process.env.MAIL_FROM?.trim() || "Panenka <bildirim@panenka.tr>",
} as const;

// Oturum/kapsam anahtarlari markadan bagimsiz: isim degisince kullanicilar
// oturumdan dusmesin diye sabit tutuluyor.
export const STORAGE_PREFIX = "matchrating";
