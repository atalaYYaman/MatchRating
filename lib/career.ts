import { sql } from "@/lib/db";
import { SKILL_KEYS } from "@/lib/skills";
import { aggregateScores } from "@/lib/scoring";
import { MAX_FINAL_SCORE, MIN_FINAL_SCORE } from "@/lib/ratings";

// Oyuncunun kariyer ozeti: puan yolculugu, mac sonu +/- zaman seridi ve
// birlikte kazandigi / karsisinda kaybettigi kisiler.
//
// Yetenek puanlari gruba ozel oldugu icin puan yolculugu her takim icin
// ayri hesaplanir. "Tum takimlar" kapsaminda takim basina ayri kartlar,
// zaman seridi ve arkadas sayimlari ise birlestirilmis gelir.

export type RatingPoint = {
  /** null ise oylardan gelen baslangic noktasi. */
  matchId: string | null;
  at: string;
  overall: number;
  delta: number;
};

export type TimelineEntry = {
  matchId: string;
  groupId: string;
  groupName: string;
  at: string;
  /** Tum yeteneklerdeki toplam degisim. */
  netDelta: number;
  /** Mac performansindan gelen kisim. */
  performanceDelta: number;
  /** Puanlamayi zamaninda yapmadigi icin kesilen kisim. */
  penaltyDelta: number;
  /** O macta arkadaslarindan aldigi ortalama puan (10 uzerinden). */
  matchAverage: number | null;
};

export type GroupJourney = {
  groupId: string;
  groupName: string;
  startOverall: number;
  currentOverall: number;
  netDelta: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: RatingPoint[];
};

export type Companion = {
  key: string;
  name: string;
  isGuest: boolean;
  count: number;
};

export type SkillCount = { skill: string; count: number };

export type CareerSummary = {
  groups: GroupJourney[];
  timeline: TimelineEntry[];
  totals: { played: number; wins: number; draws: number; losses: number };
  matchRatings: { count: number; average: number | null; best: number | null };
  strengths: SkillCount[];
  weaknesses: SkillCount[];
  wonWith: Companion[];
  lostTo: Companion[];
  /** En cok puan kazandirilan / kaybettiren mac. */
  bestMatch: TimelineEntry | null;
  worstMatch: TimelineEntry | null;
};

function clamp(value: number) {
  return Math.min(MAX_FINAL_SCORE, Math.max(MIN_FINAL_SCORE, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function topCounts(map: Map<string, Companion>, limit = 5): Companion[] {
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

export async function computeCareer(
  userId: string,
  groupId: string | null
): Promise<CareerSummary> {
  // Kapsamdaki takimlar: kullanicinin uyesi oldugu takimlar (ya da tek takim).
  const groupsRes = await sql.query(
    `SELECT g.id, g.name
     FROM groups g
     JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $1::uuid
     WHERE ($2::uuid IS NULL OR g.id = $2::uuid)
     ORDER BY g.name ASC`,
    [userId, groupId]
  );
  const groupNames = new Map<string, string>(
    groupsRes.rows.map((g) => [g.id as string, g.name as string])
  );
  const groupIds = [...groupNames.keys()];

  if (groupIds.length === 0) {
    return {
      groups: [],
      timeline: [],
      totals: { played: 0, wins: 0, draws: 0, losses: 0 },
      matchRatings: { count: 0, average: null, best: null },
      strengths: [],
      weaknesses: [],
      wonWith: [],
      lostTo: [],
      bestMatch: null,
      worstMatch: null,
    };
  }

  // @vercel/postgres etiketli sablonu dizi parametresi kabul etmedigi icin
  // takim listesi filtreleri sql.query ile gonderiliyor.
  const [votesRes, adjRes, ratingsRes, icRes, disRes] = await Promise.all([
    // Oy tabanli baslangic puani.
    sql.query(
      `SELECT group_id, skill, score FROM votes
       WHERE target_id = $1::uuid AND group_id = ANY($2::uuid[])`,
      [userId, groupIds]
    ),
    // Mac sonuclarindan gelen duzeltmeler (yetenek kirilimli, kronolojik).
    sql.query(
      `SELECT sa.group_id, sa.match_id, sa.skill, sa.delta::float8 AS delta, sa.reason,
              sa.created_at, m.scheduled_at
       FROM skill_adjustments sa
       LEFT JOIN matches m ON m.id = sa.match_id
       WHERE sa.user_id = $1::uuid AND sa.group_id = ANY($2::uuid[])
       ORDER BY COALESCE(m.scheduled_at, sa.created_at) ASC, sa.created_at ASC`,
      [userId, groupIds]
    ),
    // Aldigi mac puanlari.
    sql.query(
      `SELECT m.group_id, r.match_id, r.score::float8 AS score,
              r.strength_skill, r.weakness_skill
       FROM match_ratings r
       JOIN matches m ON m.id = r.match_id
       WHERE r.target_id = $1::uuid AND m.group_id = ANY($2::uuid[])`,
      [userId, groupIds]
    ),
    // Takim ici maclar: benim tarafim + o macta sahada olan herkes.
    sql.query(
      `WITH mine AS (
         SELECT m.id AS match_id, m.group_id, sq.side,
                m.home_score, m.away_score
         FROM matches m
         JOIN match_squads sq ON sq.match_id = m.id
         JOIN match_squad_players sp ON sp.squad_id = sq.id AND sp.user_id = $1::uuid
         WHERE m.match_kind = 'ic' AND m.status = 'completed'
           AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
           AND m.group_id = ANY($2::uuid[])
       )
       SELECT mine.match_id, mine.group_id, mine.side AS my_side,
              CASE
                WHEN mine.home_score = mine.away_score THEN 'draw'
                WHEN (mine.side = 'home' AND mine.home_score > mine.away_score)
                  OR (mine.side = 'away' AND mine.away_score > mine.home_score) THEN 'win'
                ELSE 'loss'
              END AS outcome,
              sq2.side AS other_side,
              sp2.user_id, sp2.guest_name,
              COALESCE(NULLIF(BTRIM(gm.nickname), ''), u.name) AS user_name
       FROM mine
       JOIN match_squads sq2 ON sq2.match_id = mine.match_id
       JOIN match_squad_players sp2 ON sp2.squad_id = sq2.id
       LEFT JOIN users u ON u.id = sp2.user_id
       LEFT JOIN group_members gm
         ON gm.group_id = mine.group_id AND gm.user_id = sp2.user_id
       WHERE sp2.user_id IS DISTINCT FROM $1::uuid`,
      [userId, groupIds]
    ),
    // Dis maclar: katildiysam ev sahibi (biz) sayilirim.
    sql.query(
      `SELECT m.group_id, m.home_score, m.away_score
       FROM matches m
       JOIN match_attendance a ON a.match_id = m.id AND a.user_id = $1::uuid AND a.status = 'yes'
       WHERE m.match_kind = 'dis' AND m.status = 'completed'
         AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
         AND m.group_id = ANY($2::uuid[])`,
      [userId, groupIds]
    ),
  ]);

  // ---- Oy tabanli baslangic puani (takim + yetenek bazinda)
  const votesByGroupSkill = new Map<string, number[]>();
  for (const row of votesRes.rows) {
    const key = `${row.group_id}:${row.skill}`;
    const list = votesByGroupSkill.get(key) ?? [];
    list.push(Number(row.score));
    votesByGroupSkill.set(key, list);
  }

  function baseSkills(gid: string): Record<string, number> {
    const out: Record<string, number> = {};
    for (const skill of SKILL_KEYS) {
      out[skill] = aggregateScores(votesByGroupSkill.get(`${gid}:${skill}`) ?? []).value;
    }
    return out;
  }

  function overallOf(skills: Record<string, number>) {
    let sum = 0;
    for (const skill of SKILL_KEYS) sum += clamp(skills[skill]);
    return round1(sum / SKILL_KEYS.length);
  }

  // ---- Mac basina aldigim ortalama puan (zaman seridinde gostermek icin)
  const ratingsByMatch = new Map<string, number[]>();
  const strengthCounts = new Map<string, number>();
  const weaknessCounts = new Map<string, number>();
  let ratingSum = 0;
  let ratingCount = 0;
  let ratingBest: number | null = null;

  for (const row of ratingsRes.rows) {
    const score = Number(row.score);
    const mid = row.match_id as string;
    const list = ratingsByMatch.get(mid) ?? [];
    list.push(score);
    ratingsByMatch.set(mid, list);

    ratingSum += score;
    ratingCount += 1;
    if (ratingBest === null || score > ratingBest) ratingBest = score;

    const st = row.strength_skill as string;
    const wk = row.weakness_skill as string;
    strengthCounts.set(st, (strengthCounts.get(st) ?? 0) + 1);
    weaknessCounts.set(wk, (weaknessCounts.get(wk) ?? 0) + 1);
  }

  const matchAverage = (matchId: string): number | null => {
    const list = ratingsByMatch.get(matchId);
    if (!list || list.length === 0) return null;
    return round1(list.reduce((a, b) => a + b, 0) / list.length);
  };

  // ---- Duzeltmeleri maca gore topla (kronolojik sira korunur)
  type MatchAdjust = {
    matchId: string;
    groupId: string;
    at: string;
    perSkill: Record<string, number>;
    performance: number;
    penalty: number;
  };
  const adjustOrder: MatchAdjust[] = [];
  const adjustIndex = new Map<string, MatchAdjust>();

  for (const row of adjRes.rows) {
    const matchId = (row.match_id as string) ?? "";
    const gid = row.group_id as string;
    const key = `${gid}:${matchId}`;
    let entry = adjustIndex.get(key);
    if (!entry) {
      entry = {
        matchId,
        groupId: gid,
        at: (row.scheduled_at as string) ?? (row.created_at as string),
        perSkill: {},
        performance: 0,
        penalty: 0,
      };
      adjustIndex.set(key, entry);
      adjustOrder.push(entry);
    }
    const delta = Number(row.delta);
    const skill = row.skill as string;
    entry.perSkill[skill] = (entry.perSkill[skill] ?? 0) + delta;
    if (row.reason === "no_rating_penalty") entry.penalty += delta;
    else entry.performance += delta;
  }

  // ---- Takim bazinda puan yolculugu
  const journeys = new Map<string, GroupJourney>();
  const runningSkills = new Map<string, Record<string, number>>();

  for (const gid of groupIds) {
    const base = baseSkills(gid);
    runningSkills.set(gid, { ...base });
    const startOverall = overallOf(base);
    journeys.set(gid, {
      groupId: gid,
      groupName: groupNames.get(gid) ?? "Takım",
      startOverall,
      currentOverall: startOverall,
      netDelta: 0,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: [],
    });
  }

  const timeline: TimelineEntry[] = [];

  for (const entry of adjustOrder) {
    const journey = journeys.get(entry.groupId);
    const skills = runningSkills.get(entry.groupId);
    if (!journey || !skills) continue;

    const before = overallOf(skills);
    for (const [skill, delta] of Object.entries(entry.perSkill)) {
      skills[skill] = (skills[skill] ?? 0) + delta;
    }
    const after = overallOf(skills);

    journey.currentOverall = after;
    journey.points.push({
      matchId: entry.matchId || null,
      at: entry.at,
      overall: after,
      delta: round1(after - before),
    });

    if (entry.matchId) {
      timeline.push({
        matchId: entry.matchId,
        groupId: entry.groupId,
        groupName: journey.groupName,
        at: entry.at,
        netDelta: round1(entry.performance + entry.penalty),
        performanceDelta: round1(entry.performance),
        penaltyDelta: round1(entry.penalty),
        matchAverage: matchAverage(entry.matchId),
      });
    }
  }

  for (const journey of journeys.values()) {
    journey.netDelta = round1(journey.currentOverall - journey.startOverall);
    // Baslangic noktasi grafigin ilk durumu olarak basa eklenir.
    journey.points.unshift({
      matchId: null,
      at: journey.points[0]?.at ?? new Date().toISOString(),
      overall: journey.startOverall,
      delta: 0,
    });
  }

  // ---- Galibiyet/maglubiyet ve birlikte oynanan kisiler
  const wonWith = new Map<string, Companion>();
  const lostTo = new Map<string, Companion>();
  const seenIcMatches = new Map<string, { gid: string; outcome: string }>();

  for (const row of icRes.rows) {
    const matchId = row.match_id as string;
    const outcome = row.outcome as "win" | "draw" | "loss";
    seenIcMatches.set(matchId, { gid: row.group_id as string, outcome });

    const isGuest = !row.user_id;
    const key = isGuest
      ? `guest:${row.group_id}:${row.guest_name}`
      : (row.user_id as string);
    const name = isGuest ? (row.guest_name as string) : (row.user_name as string);
    const sameSide = row.other_side === row.my_side;

    if (outcome === "win" && sameSide) {
      const c = wonWith.get(key) ?? { key, name, isGuest, count: 0 };
      c.count += 1;
      wonWith.set(key, c);
    } else if (outcome === "loss" && !sameSide) {
      const c = lostTo.get(key) ?? { key, name, isGuest, count: 0 };
      c.count += 1;
      lostTo.set(key, c);
    }
  }

  for (const [, { gid, outcome }] of seenIcMatches) {
    const journey = journeys.get(gid);
    if (!journey) continue;
    journey.played += 1;
    if (outcome === "win") journey.wins += 1;
    else if (outcome === "draw") journey.draws += 1;
    else journey.losses += 1;
  }

  for (const row of disRes.rows) {
    const journey = journeys.get(row.group_id as string);
    if (!journey) continue;
    const home = Number(row.home_score);
    const away = Number(row.away_score);
    journey.played += 1;
    if (home > away) journey.wins += 1;
    else if (home === away) journey.draws += 1;
    else journey.losses += 1;
  }

  const totals = [...journeys.values()].reduce(
    (acc, j) => ({
      played: acc.played + j.played,
      wins: acc.wins + j.wins,
      draws: acc.draws + j.draws,
      losses: acc.losses + j.losses,
    }),
    { played: 0, wins: 0, draws: 0, losses: 0 }
  );

  timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const byImpact = [...timeline].sort((a, b) => b.netDelta - a.netDelta);
  const bestMatch = byImpact.length > 0 && byImpact[0].netDelta > 0 ? byImpact[0] : null;
  const worstEntry = byImpact[byImpact.length - 1];
  const worstMatch = worstEntry && worstEntry.netDelta < 0 ? worstEntry : null;

  const sortedSkills = (m: Map<string, number>): SkillCount[] =>
    [...m.entries()]
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count);

  // Tek takim seciliyse o takimin karti hic maci olmasa da gosterilir (mevcut
  // puanini gormek anlamli). "Tum takimlar"da ise yalnizca hareket olan
  // takimlar listelenir; aksi halde sayfa bos kartlarla dolar.
  const activeJourneys = [...journeys.values()].filter(
    (j) => groupId !== null || j.played > 0 || j.points.length > 1
  );

  return {
    groups: activeJourneys,
    timeline,
    totals,
    matchRatings: {
      count: ratingCount,
      average: ratingCount > 0 ? round1(ratingSum / ratingCount) : null,
      best: ratingBest,
    },
    strengths: sortedSkills(strengthCounts),
    weaknesses: sortedSkills(weaknessCounts),
    wonWith: topCounts(wonWith),
    lostTo: topCounts(lostTo),
    bestMatch,
    worstMatch,
  };
}
