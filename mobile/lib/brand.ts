// Markanin mobil taraftaki karsiligi. Webdeki ../lib/brand.ts ile ayni
// isim ve metinleri tasir.
//
// Burada YALNIZCA gorunen metinler var: alan adi, gonderen adresi gibi
// sunucu tarafi ayarlar mobile tasinmaz, cunku e-postayi ve linkleri
// sunucu uretiyor. Mobilin bilmesi gereken tek sey ne yazacagi.

export const brand = {
  name: "Panenka",
  nameUpper: "PANENKA",
  tagline: "Halı saha takımın için puanlama ve denk kadro",
  /** Kullanicilarin ulasabilecegi adres; destek metinlerinde gosterilir. */
  supportEmail: "info@panenka.tr",
} as const;
