import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isGroupMember } from "@/lib/groupAccess";
import { matchFormat, matchOutcome } from "@/lib/matchDisplay";
import { maybeProcessMatchRatings, RATING_DEADLINE_HOURS } from "@/lib/matchRating";

const AVATAR_LIMIT = 6;
const RECENT_RESULTS = 5;

// Ana sayfanin ihtiyaci olan her seyi tek istekte dondurur: siradaki mac,
// bu ayin istatistikleri ve son macin sonucu/MVP'si. Mobilden ayri ayri
// cekmek uzak veritabaninda her biri ~300ms ek gecikme demek olurdu.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const [isMember, groupRes, nextRes, lastRes, monthRes] = await Promise.all([
    isGroupMember(params.id, session.userId),
    sql`
      SELECT id, name, invite_code, owner_id FROM groups WHERE id = ${params.id}
    `,
    sql`
      SELECT id, scheduled_at, location, match_kind, required_players, rsvp_deadline
      FROM matches
      WHERE group_id = ${params.id} AND status = 'scheduled'
        AND scheduled_at > now()
      ORDER BY scheduled_at ASC
      LIMIT 1
    `,
    sql`
      SELECT id, scheduled_at, match_kind, home_score, away_score,
             home_label, away_label, status, ratings_processed_at
      FROM matches
      WHERE group_id = ${params.id} AND status IN ('scheduled', 'completed')
        AND scheduled_at IS NOT NULL AND scheduled_at <= now()
      ORDER BY scheduled_at DESC
      LIMIT 1
    `,
    sql`
      SELECT id, match_kind, home_score, away_score, scheduled_at
      FROM matches
      WHERE group_id = ${params.id} AND status IN ('scheduled', 'completed')
        AND scheduled_at IS NOT NULL AND scheduled_at <= now()
        AND scheduled_at >= date_trunc('month', now())
      ORDER BY scheduled_at DESC
    `,
  ]);

  if (!isMember) {
    return NextResponse.json({ error: "Bu takıma erişiminiz yok." }, { status: 403 });
  }
  const group = groupRes.rows[0];
  if (!group) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 404 });

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
            ON gm.group_id = ${params.id} AND gm.user_id = a.user_id
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
            ON gm.group_id = ${params.id} AND gm.user_id = r.target_id
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
        scheduledAt: nextMatch.scheduled_at,
        location: nextMatch.location,
        matchKind: nextMatch.match_kind,
        format: matchFormat(nextMatch.required_players as number | null),
        requiredPlayers: nextMatch.required_players,
        rsvpDeadline: nextMatch.rsvp_deadline,
        attendingCount: attending.length,
        attendingNames: attending.slice(0, AVATAR_LIMIT).map((a) => a.name),
        myAttendance:
          nextAttendanceRes.rows.find((a) => a.user_id === session.userId)?.status ??
          null,
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
    const iAttended = participants.includes(session.userId);
    const scheduledAt = new Date(lastMatch.scheduled_at as string);
    const ratingOpen = iAttended && !lastMatch.ratings_processed_at;

    // Puanlamam kac oyuncu icin eksik?
    let pendingRatings = 0;
    if (ratingOpen) {
      const myRatings = await sql`
        SELECT COUNT(*)::int AS c FROM match_ratings
        WHERE match_id = ${lastMatch.id} AND rater_id = ${session.userId}
      `;
      pendingRatings = Math.max(
        0,
        participants.length - 1 - (myRatings.rows[0]?.c ?? 0)
      );
    }

    const top = lastRatingsRes.rows[0];
    lastPayload = {
      id: lastMatch.id,
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

  return NextResponse.json({
    group: {
      id: group.id,
      name: group.name,
      inviteCode: group.invite_code,
    },
    isOwner: group.owner_id === session.userId,
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
  });
}
