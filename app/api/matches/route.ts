import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { maybeProcessMatchRatings } from "@/lib/matchRating";
import { matchPhase, phaseRank } from "@/lib/matchStatus";

// Iptal edilen maclar listelerden hemen duser; bu sureden sonra kalici
// olarak silinir ki gecmis kalabalik olmasin.
const CANCELLED_RETENTION_DAYS = 7;

// GET /api/matches            -> kullanicinin tum takimlarindaki maclar
// GET /api/matches?groupId=X  -> yalnizca o takim
// Her satir ait oldugu takimin adini tasir; "Tüm takımlar" gorunumunde
// kullanici hangi macin hangi takima ait oldugunu gorebilsin diye.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const groupId = req.nextUrl.searchParams.get("groupId");

  // Eskimis iptaller temizlenir. Ayri bir zamanlayici olmadigi icin, tipki
  // puan islemede oldugu gibi, liste okunurken firsatci sekilde yapilir.
  await sql`
    DELETE FROM matches
    WHERE status = 'cancelled'
      AND created_at < now() - (${CANCELLED_RETENTION_DAYS} || ' days')::interval
  `;

  const matchesRes = await sql`
    SELECT m.id, m.group_id, g.name AS group_name, g.owner_id,
           m.mode, m.match_kind, m.required_players, m.note,
           m.scheduled_at, m.location, m.status, m.ratings_processed_at,
           m.created_at,
           COUNT(DISTINCT a.user_id) FILTER (WHERE a.status = 'yes')::int AS attending_count,
           COUNT(DISTINCT p.user_id)::int AS poll_response_count
    FROM matches m
    JOIN groups g ON g.id = m.group_id
    JOIN group_members gm ON gm.group_id = m.group_id AND gm.user_id = ${session.userId}
    LEFT JOIN match_attendance a ON a.match_id = m.id
    LEFT JOIN match_poll_responses p ON p.match_id = m.id
    WHERE (${groupId}::uuid IS NULL OR m.group_id = ${groupId}::uuid)
    GROUP BY m.id, g.name, g.owner_id
    ORDER BY COALESCE(m.scheduled_at, m.created_at) DESC
    LIMIT 100
  `;

  // Oynanmis ama henuz islenmemis maclari burada isle (ayri cron yok).
  const pending = matchesRes.rows.filter(
    (m) =>
      m.status === "scheduled" &&
      m.scheduled_at &&
      new Date(m.scheduled_at as string).getTime() <= Date.now()
  );
  if (pending.length > 0) {
    const results = await Promise.all(
      pending.map(async (m) => ({
        id: m.id as string,
        result: await maybeProcessMatchRatings(m.id as string),
      }))
    );
    const processedIds = new Set(
      results.filter((r) => r.result.processed).map((r) => r.id)
    );
    for (const row of matchesRes.rows) {
      if (processedIds.has(row.id as string)) {
        row.status = "completed";
        row.ratings_processed_at = new Date().toISOString();
      }
    }
  }

  // Siralama faza gore: once senden bir sey beklenenler (puanlanacak mac),
  // en sonda bilgi tasimayanlar (tamamlanmis, iptal).
  const withPhase: (Record<string, unknown> & {
    phase: ReturnType<typeof matchPhase>;
    scheduled_at: string | null;
    created_at: string;
  })[] = matchesRes.rows.map((m) => ({
    ...m,
    isOwner: m.owner_id === session.userId,
    phase: matchPhase(
      m as { status: string; scheduled_at: string | null; ratings_processed_at: string | null }
    ),
    scheduled_at: (m.scheduled_at as string | null) ?? null,
    created_at: m.created_at as string,
  }));

  withPhase.sort((a, b) => {
    const rank = phaseRank(a.phase) - phaseRank(b.phase);
    if (rank !== 0) return rank;
    const at = new Date((a.scheduled_at ?? a.created_at) as string).getTime();
    const bt = new Date((b.scheduled_at ?? b.created_at) as string).getTime();
    // Yaklasan maclarda en yakin ustte, gecmislerde en yeni ustte.
    return a.phase === "scheduled" || a.phase === "poll" ? at - bt : bt - at;
  });

  return NextResponse.json({ matches: withPhase });
}
