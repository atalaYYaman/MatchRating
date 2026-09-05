// Markanin TEK kaynagi. Isim ileride yine degisebilir; o yuzden kullaniciya
// gorunen her yerde bu dosya okunur, string gomulmez.
//
// Isim degistiginde: yalnizca bu dosyayi ve mobile/lib/brand.ts'i guncelle,
// sonra `npm run brand:check` ile kacak kalmadigini dogrula.
//
// DEGISTIRILMEYECEKLER (bilerek marka disinda tutuldu):
//   - storage anahtarlari (STORAGE_PREFIX): degisirse herkesin oturumu
//     kapanir ve takim kapsam secimi sifirlanir.
//   - mobil paket adi (com.otlak.matchrating): Play Store'da bir kez
//     yayinlandiktan sonra degistirilemez, yeni uygulama sayilir.

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
  /** Canli adres. */
  domain: "otlak.xyz",
  url: "https://otlak.xyz",
  /** Kullanicilarin ulasabilecegi adres. */
  supportEmail: "info@otlak.com.tr",
  /** Giden e-postalarda gorunecek gonderen. */
  mailFrom: "Panenka <bildirim@otlak.xyz>",
} as const;

// Oturum/kapsam anahtarlari markadan bagimsiz: isim degisince kullanicilar
// oturumdan dusmesin diye sabit tutuluyor.
export const STORAGE_PREFIX = "matchrating";
