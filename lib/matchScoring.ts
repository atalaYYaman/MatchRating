import { SKILL_KEYS, SkillKey } from "@/lib/skills";

// Mac sonrasi puanlamanin saf matematigi. Veritabanina dokunmaz.
//
// - Her oyuncu, ayni maca katilan digerlerini 10 uzerinden puanlar ve
//   1 guclu + 1 zayif yon secer (6 temel yetenek arasindan).
// - Oyuncunun aldigi puanlarin ortalamasinin 7'ye uzakligi yetenek
//   puanlarina yansir. Fark, en cok oy alan iki yon arasinda 2:1 oraninda
//   paylastirilir (ornek: -3 -> -2 / -1, -2.4 -> -1.6 / -0.8).
// - Puanlamasini zamaninda tamamlamayan oyuncu oylamadan cikarilir ve tum
//   yeteneklerinden NO_RATING_PENALTY kadar dusulur.

export const NEUTRAL_MATCH_SCORE = 7;
// Mac bitiminden itibaren puanlama penceresi.
export const RATING_DEADLINE_HOURS = 12;
export const NO_RATING_PENALTY = 1;
export const MIN_MATCH_SCORE = 0;
export const MAX_MATCH_SCORE = 10;
// Notr 7 oldugu icin ham fark [-7, +3] araligina dusuyordu: kotu bir mac
// iyi bir macin iki katindan fazla etkiliyor, herkes zamanla asagi
// suruklenirdi. Farki simetrik olacak sekilde kirpiyoruz.
export const MAX_MATCH_DELTA = 3;

export function isValidMatchScore(value: number): boolean {
  return (
    Number.isFinite(value) && value >= MIN_MATCH_SCORE && value <= MAX_MATCH_SCORE
  );
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function clampDelta(value: number) {
  return Math.max(-MAX_MATCH_DELTA, Math.min(MAX_MATCH_DELTA, value));
}

// Ayni sayida oy alan yetenekler icin SKILL_KEYS sirasi belirleyici olur;
// boylece ayni girdi her zaman ayni sonucu verir.
export function rankSkillVotes(votedSkills: string[]): string[] {
  const counts = new Map<string, number>();
  for (const skill of votedSkills) {
    counts.set(skill, (counts.get(skill) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return (
        SKILL_KEYS.indexOf(a[0] as SkillKey) - SKILL_KEYS.indexOf(b[0] as SkillKey)
      );
    })
    .map(([skill]) => skill);
}

// Farki en cok oy alan iki yon arasinda 2:1 oraninda dagitir.
export function distributeDelta(
  distance: number,
  rankedSkills: string[]
): { skill: string; delta: number }[] {
  if (distance === 0 || rankedSkills.length === 0) return [];

  if (rankedSkills.length === 1) {
    return [{ skill: rankedSkills[0], delta: round2(distance) }];
  }

  return [
    { skill: rankedSkills[0], delta: round2((distance * 2) / 3) },
    { skill: rankedSkills[1], delta: round2(distance / 3) },
  ];
}

export type RatingRow = {
  rater_id: string;
  target_id: string;
  score: number;
  strength_skill: string;
  weakness_skill: string;
};

export type MatchAdjustment = {
  userId: string;
  skill: string;
  delta: number;
  reason: "match_rating" | "no_rating_penalty";
};

export function computeMatchAdjustments(
  participantIds: string[],
  ratings: RatingRow[],
  excludedRaterIds: Set<string>
): MatchAdjustment[] {
  const adjustments: MatchAdjustment[] = [];
  const participants = new Set(participantIds);

  // Puanlamasini tamamlamayanlarin verdigi oylar sayilmaz.
  const validRatings = ratings.filter(
    (r) =>
      participants.has(r.rater_id) &&
      participants.has(r.target_id) &&
      !excludedRaterIds.has(r.rater_id)
  );

  const byTarget = new Map<string, RatingRow[]>();
  for (const rating of validRatings) {
    const list = byTarget.get(rating.target_id) ?? [];
    list.push(rating);
    byTarget.set(rating.target_id, list);
  }

  for (const targetId of participantIds) {
    const received = byTarget.get(targetId) ?? [];
    if (received.length === 0) continue;

    const average =
      received.reduce((sum, r) => sum + Number(r.score), 0) / received.length;
    const distance = clampDelta(average - NEUTRAL_MATCH_SCORE);
    if (Math.abs(distance) < 0.001) continue;

    // Puan 7'nin ustundeyse guclu yonler yukselir, altindaysa zayif yonler duser.
    const ranked = rankSkillVotes(
      received.map((r) => (distance > 0 ? r.strength_skill : r.weakness_skill))
    );

    for (const { skill, delta } of distributeDelta(distance, ranked)) {
      adjustments.push({ userId: targetId, skill, delta, reason: "match_rating" });
    }
  }

  // Puanlamayi zamaninda yapmayanlar: tum yeteneklerden sabit ceza.
  for (const userId of excludedRaterIds) {
    if (!participants.has(userId)) continue;
    for (const skill of SKILL_KEYS) {
      adjustments.push({
        userId,
        skill,
        delta: -NO_RATING_PENALTY,
        reason: "no_rating_penalty",
      });
    }
  }

  return adjustments;
}
