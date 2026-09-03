import { RATING_DEADLINE_HOURS } from "@/lib/matchScoring";

// Macin kullaniciya gorunen durumu zamandan TURETILIR, veritabaninda
// saklanmaz. Saklasaydik durumlari zamaninda cevirecek bir is gerekirdi;
// kimse uygulamayi acmazsa mac saatlerce "planlandi" gorunurdu.
// Yalnizca 'completed' (puanlar islenince) ve 'cancelled' gercekten saklanir.

// Hali saha maclari standart olarak 1 saat; kullaniciya sorup akisi
// agirlastirmiyoruz.
export const MATCH_DURATION_MINUTES = 60;

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

// Maclar sekmesindeki varsayilan siralama. Once senden bir sey beklenen
// maclar: puanlaman gereken mac en ustte. Mac sirasinda insan sahada,
// telefonda degil; o yuzden "oynaniyor" daha asagida.
export const PHASE_ORDER: MatchPhase[] = [
  "rating",
  "poll",
  "scheduled",
  "playing",
  "completed",
  "cancelled",
];

type MatchRow = {
  mode?: string;
  status: string;
  scheduled_at?: string | Date | null;
  ratings_processed_at?: string | Date | null;
};

export function matchEndsAt(scheduledAt: string | Date): Date {
  return new Date(
    new Date(scheduledAt).getTime() + MATCH_DURATION_MINUTES * 60 * 1000
  );
}

export function ratingDeadline(scheduledAt: string | Date): Date {
  return new Date(
    matchEndsAt(scheduledAt).getTime() + RATING_DEADLINE_HOURS * 60 * 60 * 1000
  );
}

export function matchPhase(match: MatchRow, now = Date.now()): MatchPhase {
  if (match.status === "cancelled") return "cancelled";
  if (match.status === "poll_open") return "poll";
  if (match.status === "completed") return "completed";
  if (!match.scheduled_at) return "scheduled";

  const start = new Date(match.scheduled_at).getTime();
  if (now < start) return "scheduled";
  if (now < matchEndsAt(match.scheduled_at).getTime()) return "playing";
  if (match.ratings_processed_at) return "completed";
  if (now < ratingDeadline(match.scheduled_at).getTime()) return "rating";

  // Sure doldu ama henuz kimse uygulamayi acmadigi icin islenmedi; kullaniciya
  // yine de tamamlanmis gorunur, ilk acilista islenir.
  return "completed";
}

export function phaseRank(phase: MatchPhase): number {
  const index = PHASE_ORDER.indexOf(phase);
  return index === -1 ? PHASE_ORDER.length : index;
}
