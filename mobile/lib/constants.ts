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
