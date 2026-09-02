// Mac verisinin arayuzde gosterilecek turetilmis alanlari. Web ve mobil ayni
// stringi gormesi icin sunucu tarafinda hesaplanir.

// 14 kisilik kadro -> "7v7". Tek sayi ya da tanimsizsa format gosterilmez.
export function matchFormat(requiredPlayers: number | null | undefined): string | null {
  if (!requiredPlayers || requiredPlayers < 2) return null;
  if (requiredPlayers % 2 !== 0) return null;
  const perSide = requiredPlayers / 2;
  return `${perSide}v${perSide}`;
}

export type MatchOutcome = "win" | "draw" | "loss" | null;

// Galibiyet yalnizca 'dis' maclarda anlamli: 'ic' macta iki taraf da grubun
// kendi oyunculari, grup adina bir galip yok.
export function matchOutcome(
  matchKind: string,
  homeScore: number | null | undefined,
  awayScore: number | null | undefined
): MatchOutcome {
  if (matchKind !== "dis") return null;
  if (homeScore == null || awayScore == null) return null;
  if (homeScore > awayScore) return "win";
  if (homeScore < awayScore) return "loss";
  return "draw";
}
