// 6 temel futbol yetenegi. key veritabaninda saklanir, label arayuzde gosterilir.
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
