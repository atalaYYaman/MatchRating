import { sql } from "@/lib/db";
import { matchFormat, matchOutcome } from "@/lib/matchDisplay";
import { maybeProcessMatchRatings, RATING_DEADLINE_HOURS } from "@/lib/matchRating";

// Ana sayfanin verisi. groupId verilirse o takima, verilmezse kullanicinin
// uyesi oldugu TUM takimlara bakar ("Tüm takımlar" filtresi).
//
// Tek istekte donmesinin sebebi: uzak veritabaninda her ek istek ~300ms;
// mobilden 5-6 ayri cagri yapmak ekrani gorunur sekilde yavaslatiyordu.

const AVATAR_LIMIT = 6;
const RECENT_RESULTS = 5;

export type HomeScope = { userId: string; groupId?: string | null };

export async function buildHomeData({ userId, groupId }: HomeScope) {
  const scoped = groupId ?? null;

  const [membershipRes, nextRes, lastRes, monthRes] = await Promise.all([
    // Kapsamdaki takimlar: tek takim ya da kullanicinin tum takimlari.
    sql`
      SELECT g.id, g.name, g.invite_code, g.owner_id
      FROM group_members gm
      JOIN groups g ON g.id = gm.group_id
      WHERE gm.user_id = ${userId}
        AND (${scoped}::uuid IS NULL OR g.id = ${scoped}::uuid)
    `,
    sql`
      SELECT m.id, m.group_id, g.name AS group_name, m.scheduled_at, m.location,
             m.match_kind, m.required_players, m.rsvp_deadline
      FROM matches m
      JOIN groups g ON g.id = m.group_id
      JOIN group_members gm ON gm.group_id = m.group_id AND gm.user_id = ${userId}
      WHERE m.status = 'scheduled' AND m.scheduled_at > now()
        AND (${scoped}::uuid IS NULL OR m.group_id = ${scoped}::uuid)
      ORDER BY m.scheduled_at ASC
      LIMIT 1
    `,
    sql`
      SELECT m.id, m.group_id, g.name AS group_name, m.scheduled_at, m.match_kind,
             m.home_score, m.away_score, m.home_label, m.away_label, m.status,
             m.ratings_processed_at
      FROM matches m
      JOIN groups g ON g.id = m.group_id
      JOIN group_members gm ON gm.group_id = m.group_id AND gm.user_id = ${userId}
      WHERE m.status IN ('scheduled', 'completed')
        AND m.scheduled_at IS NOT NULL AND m.scheduled_at <= now()
        AND (${scoped}::uuid IS NULL OR m.group_id = ${scoped}::uuid)
      ORDER BY m.scheduled_at DESC
      LIMIT 1
    `,
    sql`
      SELECT m.id, m.match_kind, m.home_score, m.away_score, m.scheduled_at
      FROM matches m
      JOIN group_members gm ON gm.group_id = m.group_id AND gm.user_id = ${userId}
      WHERE m.status IN ('scheduled', 'completed')
        AND m.scheduled_at IS NOT NULL AND m.scheduled_at <= now()
        AND m.scheduled_at >= date_trunc('month', now())
        AND (${scoped}::uuid IS NULL OR m.group_id = ${scoped}::uuid)
      ORDER BY m.scheduled_at DESC
    `,
  ]);

  if (membershipRes.rows.length === 0) {
    return null; // Kapsamda takim yok (uye degil ya da hic takimi yok)
  }

  const nextMatch = nextRes.rows[0] ?? null;
  const lastMatch = lastRes.rows[0] ?? null;

  // Son mac oynanmis ama islenmemisse burada isle (cron yok).
  if (lastMatch && lastMatch.status === "scheduled") {
    await maybeProcessMatchRatings(lastMatch.id as string);
  }

  const [nextAttendanceRes, lastRatingsRes, lastAttendanceRes] = await Promise.all([
    nextMatch
      ? sql`
          SELECT a.user_id, a.status,
                 COALESCE(NULLIF(BTRIM(gm.nickname), ''), u.name) AS name
          FROM match_attendance a
          JOIN users u ON u.id = a.user_id
          LEFT JOIN group_members gm
            ON gm.group_id = ${nextMatch.group_id} AND gm.user_id = a.user_id
          WHERE a.match_id = ${nextMatch.id}
        `
      : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
    lastMatch
      ? sql`
          SELECT r.target_id, AVG(r.score)::float8 AS avg_score,
                 COALESCE(NULLIF(BTRIM(gm.nickname), ''), u.name) AS name
          FROM match_ratings r
          JOIN users u ON u.id = r.target_id
          LEFT JOIN group_members gm
            ON gm.group_id = ${lastMatch.group_id} AND gm.user_id = r.target_id
          WHERE r.match_id = ${lastMatch.id}
          GROUP BY r.target_id, COALESCE(NULLIF(BTRIM(gm.nickname), ''), u.name)
          ORDER BY avg_score DESC
        `
      : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
    lastMatch
      ? sql`
          SELECT user_id FROM match_attendance
          WHERE match_id = ${lastMatch.id} AND status = 'yes'
        `
      : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
  ]);

  // --- Siradaki mac
  const attending = nextAttendanceRes.rows.filter((a) => a.status === "yes");
  const nextPayload = nextMatch
    ? {
        id: nextMatch.id,
        groupId: nextMatch.group_id,
        groupName: nextMatch.group_name,
        scheduledAt: nextMatch.scheduled_at,
        location: nextMatch.location,
        matchKind: nextMatch.match_kind,
        format: matchFormat(nextMatch.required_players as number | null),
        requiredPlayers: nextMatch.required_players,
        rsvpDeadline: nextMatch.rsvp_deadline,
        attendingCount: attending.length,
        attendingNames: attending.slice(0, AVATAR_LIMIT).map((a) => a.name),
        myAttendance:
          nextAttendanceRes.rows.find((a) => a.user_id === userId)?.status ?? null,
      }
    : null;

  // --- Bu ayin istatistikleri ('ic' maclar sayilir ama galibiyete girmez)
  let wins = 0;
  let draws = 0;
  let losses = 0;
  const recentResults: (string | null)[] = [];
  for (const row of monthRes.rows) {
    const outcome = matchOutcome(
      row.match_kind as string,
      row.home_score as number | null,
      row.away_score as number | null
    );
    if (outcome === "win") wins++;
    else if (outcome === "draw") draws++;
    else if (outcome === "loss") losses++;
    if (recentResults.length < RECENT_RESULTS) recentResults.push(outcome);
  }

  // Ust uste galibiyet: en yeniden geriye, ilk galibiyet olmayanda durur.
  let streak = 0;
  for (const row of monthRes.rows) {
    const outcome = matchOutcome(
      row.match_kind as string,
      row.home_score as number | null,
      row.away_score as number | null
    );
    if (outcome === null) continue;
    if (outcome === "win") streak++;
    else break;
  }

  // --- Son mac
  let lastPayload = null;
  if (lastMatch) {
    const participants = lastAttendanceRes.rows.map((r) => r.user_id as string);
    const iAttended = participants.includes(userId);
    const scheduledAt = new Date(lastMatch.scheduled_at as string);
    const ratingOpen = iAttended && !lastMatch.ratings_processed_at;

    let pendingRatings = 0;
    if (ratingOpen) {
      const myRatings = await sql`
        SELECT COUNT(*)::int AS c FROM match_ratings
        WHERE match_id = ${lastMatch.id} AND rater_id = ${userId}
      `;
      pendingRatings = Math.max(
        0,
        participants.length - 1 - (myRatings.rows[0]?.c ?? 0)
      );
    }

    const top = lastRatingsRes.rows[0];
    lastPayload = {
      id: lastMatch.id,
      groupId: lastMatch.group_id,
      groupName: lastMatch.group_name,
      scheduledAt: lastMatch.scheduled_at,
      matchKind: lastMatch.match_kind,
      homeScore: lastMatch.home_score,
      awayScore: lastMatch.away_score,
      homeLabel: lastMatch.home_label,
      awayLabel: lastMatch.away_label,
      outcome: matchOutcome(
        lastMatch.match_kind as string,
        lastMatch.home_score as number | null,
        lastMatch.away_score as number | null
      ),
      hasScore: lastMatch.home_score != null && lastMatch.away_score != null,
      mvp: top
        ? {
            id: top.target_id,
            name: top.name,
            average: Math.round(Number(top.avg_score) * 10) / 10,
          }
        : null,
      ratingOpen,
      pendingRatings,
      ratingDeadline: new Date(
        scheduledAt.getTime() + RATING_DEADLINE_HOURS * 60 * 60 * 1000
      ),
    };
  }

  const scopedGroup = scoped
    ? membershipRes.rows.find((g) => g.id === scoped)
    : null;

  return {
    scope: scoped ? "group" : "all",
    group: scopedGroup
      ? {
          id: scopedGroup.id,
          name: scopedGroup.name,
          inviteCode: scopedGroup.invite_code,
        }
      : null,
    groupCount: membershipRes.rows.length,
    isOwner: scopedGroup ? scopedGroup.owner_id === userId : false,
    nextMatch: nextPayload,
    monthStats: {
      played: monthRes.rows.length,
      wins,
      draws,
      losses,
      streak,
      recentResults,
    },
    lastMatch: lastPayload,
  };
}
