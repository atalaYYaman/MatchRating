export type RatedPlayer = {
  userId: string;
  name: string;
  overall: number; // 60-90 arasi ortalama puan
  primaryPosition: string | null;
  secondaryPosition: string | null;
};

export type Team = {
  index: number;
  players: RatedPlayer[];
  totalRating: number;
};

// Fisher-Yates karistirma - rastgelelik icin
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function occupyCount(team: Team, position: string | null): number {
  if (!position) return 0;
  return team.players.filter(
    (p) => p.primaryPosition === position || p.secondaryPosition === position
  ).length;
}

function isBetterTeam(candidate: Team, current: Team, player: RatedPlayer): boolean {
  // Oyuncu sayisi once dengelenir: aksi halde ayni mevkiyi oylayan bir grupta
  // (herkes "orta saha" gibi) takimlar 2'ye 4 gibi oynanamaz sekilde bolunebilir.
  if (candidate.players.length !== current.players.length) {
    return candidate.players.length < current.players.length;
  }

  const cPrimary = occupyCount(candidate, player.primaryPosition);
  const tPrimary = occupyCount(current, player.primaryPosition);
  if (cPrimary !== tPrimary) return cPrimary < tPrimary;

  const cSecondary = occupyCount(candidate, player.secondaryPosition);
  const tSecondary = occupyCount(current, player.secondaryPosition);
  if (cSecondary !== tSecondary) return cSecondary < tSecondary;

  return candidate.totalRating < current.totalRating;
}

/**
 * Rastgele ama dengeli takimlar olusturur.
 * 1) Oyuncular once rastgele karistirilir (esit puanlilar arasinda adalet).
 * 2) Puana gore buyukten kucuge siralanir.
 * 3) Her oyuncu, ayni mevkide (once birincil, sonra ikincil) daha az oyuncusu
 *    olan takima eklenir; esitlikte toplam puani dusuk olan tercih edilir.
 *    Boylece mevki adetleri ve guc birbirine yakin kalir.
 */
export function generateBalancedTeams(
  players: RatedPlayer[],
  teamCount: number
): Team[] {
  if (teamCount < 2) teamCount = 2;
  if (teamCount > players.length) teamCount = Math.max(2, players.length);

  const shuffled = shuffle(players);
  const sorted = [...shuffled].sort((a, b) => b.overall - a.overall);

  const teams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
    index: i,
    players: [],
    totalRating: 0,
  }));

  for (const player of sorted) {
    let target = teams[0];
    for (const t of teams) {
      if (isBetterTeam(t, target, player)) target = t;
    }
    target.players.push(player);
    target.totalRating += player.overall;
  }

  return teams;
}
