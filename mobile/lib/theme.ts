// MatchRating tasarim sistemi — Claude Design projesindeki token'larin
// React Native karsiligi. Kaynak: _ds/.../tokens/*.css
//
// Kimlik: "mac gunu programi / stadyum bileti" — sportif ama sakin.
// Derinlik golgeyle degil, 1px hairline kenarlikla ifade edilir.

export const colors = {
  // Marka
  pitch900: "#12321F",
  pitch700: "#1A4C34",
  pitch: "#1F5C3F",
  pitch500: "#256E4C",
  pitch300: "#4B8F6C",
  pitch100: "#DCEAE1",

  chalk: "#F5F3EC",
  chalk100: "#FBFAF6",
  chalk200: "#EFEBE0",
  chalk300: "#E4DECE",

  ink: "#16231C",
  ink700: "#33413A",
  ink500: "#5B6660",
  ink300: "#8B948E",
  ink100: "#C7CCC7",

  amber: "#E8A33D",
  amber700: "#C27E23",
  amber100: "#FBE7C6",

  brick: "#B14A3B",
  brick100: "#F3DCD6",

  // Anlamsal
  surfacePage: "#F5F3EC",
  surfaceCard: "#FBFAF6",
  surfaceCardRaised: "#FFFFFF",
  surfaceSunken: "#EFEBE0",
  surfaceBrand: "#1F5C3F",

  textPrimary: "#16231C",
  textSecondary: "#5B6660",
  textTertiary: "#8B948E",
  textOnBrand: "#FBFAF6",
  textOnAccent: "#16231C",
  textLink: "#1F5C3F",

  borderDefault: "#C7CCC7",
  borderStrong: "#8B948E",
  borderBrand: "#1F5C3F",

  stateSuccess: "#256E4C",
  stateWarning: "#C27E23",
  stateDanger: "#B14A3B",
};

// 4px tabanli olcek
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
};

export const radius = {
  card: 14,
  button: 10,
  input: 10,
  pill: 999,
  chip: 8,
  sm: 6,
};

export const border = {
  width: 1,
  widthThick: 1.5,
};

// Archivo = skorbord/baslik, Public Sans = govde metni.
export const fonts = {
  display: "Archivo_700Bold",
  displaySemi: "Archivo_600SemiBold",
  displayExtra: "Archivo_800ExtraBold",
  body: "PublicSans_400Regular",
  bodyMedium: "PublicSans_500Medium",
  bodySemi: "PublicSans_600SemiBold",
};

// typography.css karsiligi. RN'de "font" kisayolu olmadigi icin acilmis hali.
// Tipografi olcegi: alti basamak, baskasi yok.
//   11 etiket · 13 yardimci · 15 govde · 20 baslik · 28 sayfa · 34 skor
// Ara punto eklemek yerine agirlik ve harf araligiyla ayrilir. Webdeki
// app/globals.css icindeki --text-* degiskenleriyle ayni degerler.
export const type = {
  displayM: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32 },
  displayS: { fontFamily: fonts.displaySemi, fontSize: 20, lineHeight: 24 },

  scoreL: { fontFamily: fonts.displayExtra, fontSize: 34, lineHeight: 34 },
  scoreM: { fontFamily: fonts.displayExtra, fontSize: 20, lineHeight: 22 },
  scoreS: { fontFamily: fonts.display, fontSize: 15, lineHeight: 15 },

  labelS: {
    fontFamily: fonts.displaySemi,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 0.66,
  },

  bodyM: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23 },
  bodyS: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  bodyMMedium: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 23 },
  bodySMedium: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 19 },
} as const;
