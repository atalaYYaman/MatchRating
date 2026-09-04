// Web tarafindaki lib/skills.ts, lib/positions.ts, lib/scoring.ts ile ayni
// degerler. Backend'de degisirse burada da guncellenmeli.

export const SKILLS = [
  { key: "sut", label: "Şut" },
  { key: "pas", label: "Pas" },
  { key: "dribling", label: "Dribling" },
  { key: "hiz", label: "Hız" },
  { key: "fizik", label: "Fizik" },
  { key: "defans", label: "Defans" },
] as const;

export type SkillKey = (typeof SKILLS)[number]["key"];
export const SKILL_KEYS: SkillKey[] = SKILLS.map((s) => s.key);

export const POSITIONS = [
  { key: "kaleci", label: "Kaleci" },
  { key: "stoper", label: "Stoper" },
  { key: "bek", label: "Bek" },
  { key: "orta_saha", label: "Orta saha" },
  { key: "kanat", label: "Kanat" },
  { key: "forvet", label: "Forvet" },
] as const;

export type PositionKey = (typeof POSITIONS)[number]["key"];

export function positionLabel(key: string | null | undefined): string {
  return POSITIONS.find((p) => p.key === key)?.label ?? "—";
}

export const MIN_SCORE = 60;
export const MAX_SCORE = 90;
export const DEFAULT_SCORE = 75;

// Mac fazlari — sunucudaki lib/matchStatus.ts ile ayni etiketler.
// Faz zamandan turetilip API'den geliyor; burada yalnizca gosterim var.
export type MatchPhase =
  | "poll"
  | "scheduled"
  | "playing"
  | "rating"
  | "completed"
  | "cancelled";

export const PHASE_LABEL: Record<MatchPhase, string> = {
  poll: "Anket açık",
  scheduled: "Planlandı",
  playing: "Oynanıyor",
  rating: "Puanlanıyor",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

// Faz rozeti yalnizca macin durumunu anlatir: yesil = surüyor, gri = bitti,
// kirmizi = iptal. Amber bilerek disarida birakildi; o renk artik tek bir sey
// icin ayrildi: "senden bir sey bekleniyor" (bkz. needsMyAction).
export const PHASE_TONE: Record<
  MatchPhase,
  "neutral" | "brand" | "accent" | "danger"
> = {
  rating: "brand",
  poll: "brand",
  scheduled: "brand",
  playing: "brand",
  completed: "neutral",
  cancelled: "danger",
};
