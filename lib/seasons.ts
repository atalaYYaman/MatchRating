import { sql } from "@/lib/db";
import { computeGroupRatings } from "@/lib/ratings";
import { computeGroupRecords } from "@/lib/records";

export type Season = {
  id: string;
  group_id: string;
  name: string;
  status: "active" | "closed";
  created_at: string;
  closed_at: string | null;
};

// Kapatilan sezonun dondurulmus ozeti. Icerik ileride zenginlestirilebilir;
// simdilik sirlama (guc) + G-B-M kaydi + MVP tutuluyor.
export type SeasonSummary = {
  standings: { userId: string; name: string; overall: number }[];
  records: {
    userId: string;
    name: string;
    played: number;
    wins: number;
    draws: number;
    losses: number;
  }[];
  mvp: { userId: string; name: string; wins: number } | null;
  matchCount: number;
};

// Grubun aktif sezonu. Yoksa (yeni grup, eski veri) guvenli sekilde olusturur.
export async function getActiveSeason(groupId: string): Promise<Season> {
  const res = await sql`
    SELECT id, group_id, name, status, created_at, closed_at
    FROM seasons WHERE group_id = ${groupId} AND status = 'active'
    LIMIT 1
  `;
  if (res.rows[0]) return res.rows[0] as Season;

  // Aktif sezon yoksa siradaki adla ac.
  const name = await nextSeasonName(groupId);
  const created = await sql`
    INSERT INTO seasons (group_id, name, status)
    VALUES (${groupId}, ${name}, 'active')
    ON CONFLICT DO NOTHING
    RETURNING id, group_id, name, status, created_at, closed_at
  `;
  if (created.rows[0]) return created.rows[0] as Season;

  // Yaris kosulu: baska bir istek ayni anda actiysa onu oku.
  const again = await sql`
    SELECT id, group_id, name, status, created_at, closed_at
    FROM seasons WHERE group_id = ${groupId} AND status = 'active'
    LIMIT 1
  `;
  return again.rows[0] as Season;
}

// "Sezon N" — gruptaki toplam sezon sayisi + 1.
export async function nextSeasonName(groupId: string): Promise<string> {
  const res = await sql`
    SELECT count(*)::int AS c FROM seasons WHERE group_id = ${groupId}
  `;
  const count = Number(res.rows[0]?.c ?? 0);
  return `Sezon ${count + 1}`;
}

export async function listSeasons(groupId: string): Promise<
  (Season & { matchCount: number })[]
> {
  const res = await sql`
    SELECT s.id, s.group_id, s.name, s.status, s.created_at, s.closed_at,
           (SELECT count(*)::int FROM matches m WHERE m.season_id = s.id) AS match_count
    FROM seasons s
    WHERE s.group_id = ${groupId}
    ORDER BY s.created_at DESC
  `;
  return res.rows.map((r) => ({
    id: r.id as string,
    group_id: r.group_id as string,
    name: r.name as string,
    status: r.status as "active" | "closed",
    created_at: r.created_at as string,
    closed_at: (r.closed_at as string) ?? null,
    matchCount: Number(r.match_count),
  }));
}

export async function getSeason(
  groupId: string,
  seasonId: string
): Promise<(Season & { summary: SeasonSummary | null; matchCount: number }) | null> {
  const res = await sql`
    SELECT id, group_id, name, status, created_at, closed_at, summary,
           (SELECT count(*)::int FROM matches m WHERE m.season_id = id) AS match_count
    FROM seasons WHERE id = ${seasonId} AND group_id = ${groupId}
  `;
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id as string,
    group_id: row.group_id as string,
    name: row.name as string,
    status: row.status as "active" | "closed",
    created_at: row.created_at as string,
    closed_at: (row.closed_at as string) ?? null,
    matchCount: Number(row.match_count),
    // Aktif sezonda henuz dondurulmus ozet yok; anlik hesaplanir (asagida API).
    summary: (row.summary as SeasonSummary | null) ?? null,
  };
}

// O anki durumdan bir ozet uretir (kapatirken dondurmek ya da aktif sezonu
// canli gostermek icin).
export async function buildSeasonSummary(
  groupId: string,
  seasonId: string
): Promise<SeasonSummary> {
  const [ratings, records, countRes] = await Promise.all([
    computeGroupRatings(groupId),
    computeGroupRecords(groupId, seasonId),
    sql`SELECT count(*)::int AS c FROM matches WHERE season_id = ${seasonId} AND status = 'completed'`,
  ]);

  const nameById = new Map(ratings.map((r) => [r.userId, r.name]));

  const recordList = [...records.entries()].map(([userId, rec]) => ({
    userId,
    name: nameById.get(userId) ?? "Oyuncu",
    ...rec,
  }));
  recordList.sort((a, b) => b.wins - a.wins || b.played - a.played);

  const mvp =
    recordList.length > 0 && recordList[0].wins > 0
      ? {
          userId: recordList[0].userId,
          name: recordList[0].name,
          wins: recordList[0].wins,
        }
      : null;

  return {
    standings: ratings.map((r) => ({
      userId: r.userId,
      name: r.name,
      overall: r.overall,
    })),
    records: recordList,
    mvp,
    matchCount: Number(countRes.rows[0]?.c ?? 0),
  };
}

// Aktif sezonu kapatir: o anki ozeti dondurur, kapatir ve otomatik adli yeni
// sezon acar. Yeni acilan sezonu dondurur.
export async function closeActiveSeason(groupId: string): Promise<Season> {
  const active = await sql`
    SELECT id FROM seasons WHERE group_id = ${groupId} AND status = 'active' LIMIT 1
  `;
  const activeId = active.rows[0]?.id as string | undefined;
  if (!activeId) {
    throw new Error("Kapatılacak aktif sezon yok.");
  }

  const summary = await buildSeasonSummary(groupId, activeId);

  await sql`
    UPDATE seasons
    SET status = 'closed', closed_at = now(), summary = ${JSON.stringify(summary)}::jsonb
    WHERE id = ${activeId}
  `;

  const name = await nextSeasonName(groupId);
  const created = await sql`
    INSERT INTO seasons (group_id, name, status)
    VALUES (${groupId}, ${name}, 'active')
    RETURNING id, group_id, name, status, created_at, closed_at
  `;
  return created.rows[0] as Season;
}
