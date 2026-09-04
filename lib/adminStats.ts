import { sql } from "@/lib/db";

// Platform genel gorunumu. Butun sorgular toplu (aggregate) calisir; tek tek
// kimin kime kac puan verdigi gibi kisisel veriler panele tasinmaz.

export type FunnelStep = { label: string; count: number };

export type AdminStats = {
  totals: {
    users: number;
    groups: number;
    matches: number;
    completedMatches: number;
    votes: number;
    matchRatings: number;
  };
  growth: {
    usersLast7: number;
    usersLast30: number;
    groupsLast30: number;
    matchesLast30: number;
  };
  active: {
    /** Son 7/30 gunde herhangi bir eylemde bulunan kullanici sayisi. */
    users7: number;
    users30: number;
  };
  /** Kayittan cekirdek dongunun sonuna kadar nerede dusuyorlar. */
  funnel: FunnelStep[];
  health: {
    /** Puanlama penceresini gorup puanlamasini tamamlayanlarin orani. */
    ratingCompletionPct: number | null;
    ratingParticipants: number;
    ratingPenalised: number;
    /** Tamamlanan maclarin kacina skor girilmis. */
    scoreEnteredPct: number | null;
    /** Takim ici maclarin kacinda kadro kaydedilmis. */
    squadUsagePct: number | null;
    /** Yoklama alinan maclarda ortalama katilim cevabi. */
    avgAttendanceResponses: number | null;
  };
  groups: {
    total: number;
    withMatch: number;
    withCompletedMatch: number;
    dead: number;
  };
  /** En hareketli takimlar (mac sayisina gore). */
  topGroups: {
    id: string;
    name: string;
    members: number;
    matches: number;
    completed: number;
    lastActivity: string | null;
  }[];
  /** Son kayitlar; kimin geldigini gormek icin. */
  recentUsers: { id: string; name: string; email: string; created_at: string; groups: number }[];
  feedback: { open: number; total: number };
};

function pct(part: number, whole: number): number | null {
  if (!whole) return null;
  return Math.round((part / whole) * 1000) / 10;
}

export async function computeAdminStats(): Promise<AdminStats> {
  const [
    totalsRes,
    growthRes,
    activeRes,
    funnelRes,
    ratingHealthRes,
    scoreHealthRes,
    squadHealthRes,
    attendanceRes,
    groupHealthRes,
    topGroupsRes,
    recentUsersRes,
    feedbackRes,
  ] = await Promise.all([
    sql`
      SELECT
        (SELECT count(*)::int FROM users) AS users,
        (SELECT count(*)::int FROM groups) AS groups,
        (SELECT count(*)::int FROM matches) AS matches,
        (SELECT count(*)::int FROM matches WHERE status = 'completed') AS completed_matches,
        (SELECT count(*)::int FROM votes) AS votes,
        (SELECT count(*)::int FROM match_ratings) AS match_ratings
    `,
    sql`
      SELECT
        (SELECT count(*)::int FROM users WHERE created_at > now() - interval '7 days') AS users_7,
        (SELECT count(*)::int FROM users WHERE created_at > now() - interval '30 days') AS users_30,
        (SELECT count(*)::int FROM groups WHERE created_at > now() - interval '30 days') AS groups_30,
        (SELECT count(*)::int FROM matches WHERE created_at > now() - interval '30 days') AS matches_30
    `,
    // Aktif = son X gunde oy vermis, mac puanlamis, yoklama vermis ya da
    // mac olusturmus. Sadece giris yapmak "kullaniyor" saymaz.
    sql`
      WITH acts AS (
        SELECT voter_id AS user_id, created_at FROM votes
        UNION ALL SELECT rater_id, created_at FROM match_ratings
        UNION ALL SELECT user_id, updated_at FROM match_attendance
        UNION ALL SELECT created_by, created_at FROM matches
      )
      SELECT
        count(DISTINCT user_id) FILTER (WHERE created_at > now() - interval '7 days')::int AS users_7,
        count(DISTINCT user_id) FILTER (WHERE created_at > now() - interval '30 days')::int AS users_30
      FROM acts
    `,
    sql`
      SELECT
        (SELECT count(*)::int FROM users) AS kayit,
        (SELECT count(DISTINCT user_id)::int FROM group_members) AS takima_katildi,
        (SELECT count(DISTINCT voter_id)::int FROM votes) AS oy_verdi,
        (SELECT count(DISTINCT user_id)::int FROM match_attendance WHERE status = 'yes') AS maca_katildi,
        (SELECT count(DISTINCT rater_id)::int FROM match_ratings) AS mac_puanladi
    `,
    // Puanlama tamamlama: islenmis maclarda katilimci sayisi vs ceza yiyen
    // (yani puanlamasini zamaninda bitirmeyen) sayisi.
    sql`
      SELECT
        (SELECT count(*)::int
           FROM match_attendance a
           JOIN matches m ON m.id = a.match_id
          WHERE a.status = 'yes' AND m.ratings_processed_at IS NOT NULL) AS participants,
        (SELECT count(DISTINCT (user_id, match_id))::int
           FROM skill_adjustments
          WHERE reason = 'no_rating_penalty') AS penalised
    `,
    sql`
      SELECT
        count(*)::int AS completed,
        count(*) FILTER (WHERE home_score IS NOT NULL AND away_score IS NOT NULL)::int AS with_score
      FROM matches WHERE status = 'completed'
    `,
    sql`
      SELECT
        count(*)::int AS ic_matches,
        count(*) FILTER (WHERE EXISTS (SELECT 1 FROM match_squads s WHERE s.match_id = m.id))::int AS with_squad
      FROM matches m WHERE m.match_kind = 'ic' AND m.status <> 'cancelled'
    `,
    sql`
      SELECT COALESCE(AVG(c), 0)::float8 AS avg_responses FROM (
        SELECT count(*)::int AS c
        FROM match_attendance a
        JOIN matches m ON m.id = a.match_id
        WHERE m.status IN ('scheduled', 'completed')
        GROUP BY a.match_id
      ) t
    `,
    sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE EXISTS (SELECT 1 FROM matches m WHERE m.group_id = g.id))::int AS with_match,
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM matches m WHERE m.group_id = g.id AND m.status = 'completed'
        ))::int AS with_completed
      FROM groups g
    `,
    sql`
      SELECT g.id, g.name,
             (SELECT count(*)::int FROM group_members gm WHERE gm.group_id = g.id) AS members,
             (SELECT count(*)::int FROM matches m WHERE m.group_id = g.id) AS matches,
             (SELECT count(*)::int FROM matches m WHERE m.group_id = g.id AND m.status = 'completed') AS completed,
             (SELECT max(COALESCE(m.scheduled_at, m.created_at)) FROM matches m WHERE m.group_id = g.id) AS last_activity
      FROM groups g
      ORDER BY matches DESC, members DESC
      LIMIT 10
    `,
    sql`
      SELECT u.id, u.name, u.email, u.created_at,
             (SELECT count(*)::int FROM group_members gm WHERE gm.user_id = u.id) AS groups
      FROM users u ORDER BY u.created_at DESC LIMIT 10
    `,
    sql`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE status = 'yeni')::int AS open
      FROM feedback
    `,
  ]);

  const t = totalsRes.rows[0];
  const f = funnelRes.rows[0];
  const rh = ratingHealthRes.rows[0];
  const sh = scoreHealthRes.rows[0];
  const qh = squadHealthRes.rows[0];
  const gh = groupHealthRes.rows[0];

  const participants = Number(rh.participants);
  const penalised = Number(rh.penalised);

  return {
    totals: {
      users: Number(t.users),
      groups: Number(t.groups),
      matches: Number(t.matches),
      completedMatches: Number(t.completed_matches),
      votes: Number(t.votes),
      matchRatings: Number(t.match_ratings),
    },
    growth: {
      usersLast7: Number(growthRes.rows[0].users_7),
      usersLast30: Number(growthRes.rows[0].users_30),
      groupsLast30: Number(growthRes.rows[0].groups_30),
      matchesLast30: Number(growthRes.rows[0].matches_30),
    },
    active: {
      users7: Number(activeRes.rows[0].users_7),
      users30: Number(activeRes.rows[0].users_30),
    },
    funnel: [
      { label: "Kayıt oldu", count: Number(f.kayit) },
      { label: "Bir takıma katıldı", count: Number(f.takima_katildi) },
      { label: "Oy verdi", count: Number(f.oy_verdi) },
      { label: "Bir maça çıktı", count: Number(f.maca_katildi) },
      { label: "Maç puanladı", count: Number(f.mac_puanladi) },
    ],
    health: {
      ratingCompletionPct:
        participants > 0 ? pct(participants - penalised, participants) : null,
      ratingParticipants: participants,
      ratingPenalised: penalised,
      scoreEnteredPct: pct(Number(sh.with_score), Number(sh.completed)),
      squadUsagePct: pct(Number(qh.with_squad), Number(qh.ic_matches)),
      avgAttendanceResponses:
        Math.round(Number(attendanceRes.rows[0].avg_responses) * 10) / 10 || null,
    },
    groups: {
      total: Number(gh.total),
      withMatch: Number(gh.with_match),
      withCompletedMatch: Number(gh.with_completed),
      dead: Number(gh.total) - Number(gh.with_match),
    },
    topGroups: topGroupsRes.rows.map((g) => ({
      id: g.id as string,
      name: g.name as string,
      members: Number(g.members),
      matches: Number(g.matches),
      completed: Number(g.completed),
      lastActivity: (g.last_activity as string) ?? null,
    })),
    recentUsers: recentUsersRes.rows.map((u) => ({
      id: u.id as string,
      name: u.name as string,
      email: u.email as string,
      created_at: u.created_at as string,
      groups: Number(u.groups),
    })),
    feedback: {
      open: Number(feedbackRes.rows[0].open),
      total: Number(feedbackRes.rows[0].total),
    },
  };
}
