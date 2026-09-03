import { sql } from "@/lib/db";

export type UserRecord = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
};

function outcome(home: number, away: number, isHomeSide: boolean): "win" | "draw" | "loss" {
  if (home === away) return "draw";
  const homeWon = home > away;
  return homeWon === isHomeSide ? "win" : "loss";
}

function bump(map: Map<string, UserRecord>, userId: string, result: "win" | "draw" | "loss") {
  const rec = map.get(userId) ?? { played: 0, wins: 0, draws: 0, losses: 0 };
  rec.played += 1;
  if (result === "win") rec.wins += 1;
  else if (result === "draw") rec.draws += 1;
  else rec.losses += 1;
  map.set(userId, rec);
}

// Grup icindeki tum uyelerin galibiyet/beraberlik/maglubiyet sayisi.
// 'dis' maclarda katilan herkes ev sahibi (biz) sayilir. 'ic' maclarda
// sonuc, kadroda hangi tarafta oldugunuza gore hesaplanir (kadro yoksa o
// mac sayilmaz).
export async function computeGroupRecords(groupId: string): Promise<Map<string, UserRecord>> {
  const [disRows, icRows] = await Promise.all([
    sql`
      SELECT a.user_id, m.home_score, m.away_score
      FROM matches m
      JOIN match_attendance a ON a.match_id = m.id AND a.status = 'yes'
      WHERE m.group_id = ${groupId} AND m.match_kind = 'dis' AND m.status = 'completed'
        AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
    `,
    sql`
      SELECT sp.user_id, sq.side, m.home_score, m.away_score
      FROM matches m
      JOIN match_squads sq ON sq.match_id = m.id
      JOIN match_squad_players sp ON sp.squad_id = sq.id AND sp.user_id IS NOT NULL
      WHERE m.group_id = ${groupId} AND m.match_kind = 'ic' AND m.status = 'completed'
        AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
    `,
  ]);

  const records = new Map<string, UserRecord>();

  for (const row of disRows.rows) {
    const home = Number(row.home_score);
    const away = Number(row.away_score);
    bump(records, row.user_id as string, outcome(home, away, true));
  }

  for (const row of icRows.rows) {
    const home = Number(row.home_score);
    const away = Number(row.away_score);
    bump(records, row.user_id as string, outcome(home, away, row.side === "home"));
  }

  return records;
}
