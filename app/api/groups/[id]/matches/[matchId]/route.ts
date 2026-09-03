import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isGroupMember } from "@/lib/groupAccess";
import { maybeProcessMatchRatings } from "@/lib/matchRating";
import { matchPhase, ratingDeadline } from "@/lib/matchStatus";
import { getMatchSquads } from "@/lib/squads";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; matchId: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const isMember = await isGroupMember(params.id, session.userId);
  if (!isMember) {
    return NextResponse.json({ error: "Bu takıma erişiminiz yok." }, { status: 403 });
  }

  // Mac oynandiysa ve kosullar saglaniyorsa puanlari isle.
  await maybeProcessMatchRatings(params.matchId);

  const [matchRes, optionsRes, responsesRes, optionVotesRes, attendanceRes, myRatingsRes, squads] =
    await Promise.all([
      sql`
        SELECT id, group_id, created_by, mode, match_kind, required_players, note,
               scheduled_at, location, status, ratings_processed_at, created_at
        FROM matches WHERE id = ${params.matchId} AND group_id = ${params.id}
      `,
      sql`
        SELECT id, starts_at, location FROM match_options
        WHERE match_id = ${params.matchId}
        ORDER BY starts_at ASC
      `,
      sql`
        SELECT r.user_id, r.available,
               COALESCE(NULLIF(BTRIM(gm.nickname), ''), u.name) AS name
        FROM match_poll_responses r
        JOIN users u ON u.id = r.user_id
        LEFT JOIN group_members gm ON gm.group_id = ${params.id} AND gm.user_id = r.user_id
        WHERE r.match_id = ${params.matchId}
      `,
      sql`
        SELECT option_id, user_id FROM match_poll_option_votes
        WHERE match_id = ${params.matchId}
      `,
      sql`
        SELECT a.user_id, a.status,
               COALESCE(NULLIF(BTRIM(gm.nickname), ''), u.name) AS name
        FROM match_attendance a
        JOIN users u ON u.id = a.user_id
        LEFT JOIN group_members gm ON gm.group_id = ${params.id} AND gm.user_id = a.user_id
        WHERE a.match_id = ${params.matchId}
      `,
      sql`
        SELECT target_id, score, strength_skill, weakness_skill
        FROM match_ratings
        WHERE match_id = ${params.matchId} AND rater_id = ${session.userId}
      `,
      getMatchSquads(params.matchId),
    ]);

  const match = matchRes.rows[0];
  if (!match) return NextResponse.json({ error: "Maç bulunamadı." }, { status: 404 });

  const votesByOption = new Map<string, string[]>();
  for (const row of optionVotesRes.rows) {
    const list = votesByOption.get(row.option_id as string) ?? [];
    list.push(row.user_id as string);
    votesByOption.set(row.option_id as string, list);
  }

  const scheduledAt = match.scheduled_at ? new Date(match.scheduled_at as string) : null;
  const played = scheduledAt !== null && scheduledAt.getTime() <= Date.now();
  const deadline = scheduledAt ? ratingDeadline(scheduledAt) : null;

  const attendees = attendanceRes.rows.filter((a) => a.status === "yes");
  const iAmAttending = attendees.some((a) => a.user_id === session.userId);

  return NextResponse.json({
    match,
    isOwner: match.created_by === session.userId,
    options: optionsRes.rows.map((o) => ({
      id: o.id,
      startsAt: o.starts_at,
      location: o.location,
      voterIds: votesByOption.get(o.id as string) ?? [],
      voteCount: (votesByOption.get(o.id as string) ?? []).length,
    })),
    pollResponses: responsesRes.rows,
    myPollResponse:
      responsesRes.rows.find((r) => r.user_id === session.userId) ?? null,
    myOptionIds: optionVotesRes.rows
      .filter((v) => v.user_id === session.userId)
      .map((v) => v.option_id),
    attendance: attendanceRes.rows,
    myAttendance:
      attendanceRes.rows.find((a) => a.user_id === session.userId)?.status ?? null,
    phase: matchPhase(match as { status: string; scheduled_at: string | null; ratings_processed_at: string | null }),
    // Kadrolar yalnizca takim ici maclarda anlamli.
    squads: match.match_kind === "ic" ? squads : null,
    rating: {
      // Puanlama yalnizca maca katilanlara ve mac oynandiktan sonra acik.
      open: played && !match.ratings_processed_at && iAmAttending,
      played,
      deadline,
      myRatings: myRatingsRes.rows,
      participants: attendees.map((a) => ({ id: a.user_id, name: a.name })),
      // Kendini puanlayamazsin; arayuzde kendi kartinin cikmamasi icin
      // hedef listesi sunucuda ayriliyor.
      targets: attendees
        .filter((a) => a.user_id !== session.userId)
        .map((a) => ({ id: a.user_id, name: a.name })),
    },
  });
}

// DELETE: yalnizca maci olusturan yonetici iptal edebilir.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; matchId: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const matchRes = await sql`
    SELECT m.id, m.status, g.owner_id
    FROM matches m JOIN groups g ON g.id = m.group_id
    WHERE m.id = ${params.matchId} AND m.group_id = ${params.id}
  `;
  const match = matchRes.rows[0];
  if (!match) return NextResponse.json({ error: "Maç bulunamadı." }, { status: 404 });
  if (match.owner_id !== session.userId) {
    return NextResponse.json(
      { error: "Bu işlem için grubun yöneticisi olmalısınız." },
      { status: 403 }
    );
  }
  if (match.status === "completed") {
    return NextResponse.json(
      { error: "Tamamlanmış maç iptal edilemez." },
      { status: 400 }
    );
  }

  await sql`UPDATE matches SET status = 'cancelled' WHERE id = ${params.matchId}`;
  return NextResponse.json({ ok: true });
}
