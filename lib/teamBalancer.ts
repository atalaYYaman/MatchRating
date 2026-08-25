export type RatedPlayer = {
  userId: string;
  name: string;
  overall: number; // 1-10 arasi ortalama puan
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

/**
 * Rastgele ama dengeli takimlar olusturur.
 * 1) Oyuncular once rastgele karistirilir (esit puanlilar arasinda adalet).
 * 2) Puana gore buyukten kucuge siralanir (stabil sort sayesinde esitler
 *    karisik sirada kalir).
 * 3) Her oyuncu, o an toplam puani en dusuk olan takima eklenir (greedy
 *    balancing). Boylece takimlarin toplam/ortalama gucu birbirine yakin
 *    olur, ama kadro rastgele sekillenir.
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
    // Toplam puani en dusuk (esitlikte oyuncu sayisi en az) takimi bul
    let target = teams[0];
    for (const t of teams) {
      if (
        t.totalRating < target.totalRating ||
        (t.totalRating === target.totalRating &&
          t.players.length < target.players.length)
      ) {
        target = t;
      }
    }
    target.players.push(player);
    target.totalRating += player.overall;
  }

  return teams;
}
