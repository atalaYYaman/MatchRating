import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isGroupOwner } from "@/lib/groupAccess";

function parseScore(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 99) return null;
  return Math.round(num);
}

function parseLabel(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim().slice(0, 40)
    : fallback;
}

// PATCH: { homeScore, awayScore, homeLabel?, awayLabel? }
// Mac oynandiktan sonra skoru yonetici girer.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; matchId: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const [isOwner, matchRes] = await Promise.all([
    isGroupOwner(params.id, session.userId),
    sql`
      SELECT id, match_kind, scheduled_at, status FROM matches
      WHERE id = ${params.matchId} AND group_id = ${params.id}
    `,
  ]);

  if (!isOwner) {
    return NextResponse.json(
      { error: "Bu işlem için grubun yöneticisi olmalısınız." },
      { status: 403 }
    );
  }
  const match = matchRes.rows[0];
  if (!match) return NextResponse.json({ error: "Maç bulunamadı." }, { status: 404 });
  if (match.status === "cancelled") {
    return NextResponse.json({ error: "İptal edilmiş maç." }, { status: 400 });
  }
  if (
    !match.scheduled_at ||
    new Date(match.scheduled_at as string).getTime() > Date.now()
  ) {
    return NextResponse.json({ error: "Maç henüz oynanmadı." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const homeScore = parseScore(body?.homeScore);
  const awayScore = parseScore(body?.awayScore);
  if (homeScore === null || awayScore === null) {
    return NextResponse.json(
      { error: "İki taraf için de 0-99 arası skor girin." },
      { status: 400 }
    );
  }

  const isInternal = match.match_kind === "ic";
  const homeLabel = parseLabel(body?.homeLabel, isInternal ? "Takım 1" : "Bizim takım");
  const awayLabel = parseLabel(body?.awayLabel, isInternal ? "Takım 2" : "Rakip");

  await sql`
    UPDATE matches
    SET home_score = ${homeScore}, away_score = ${awayScore},
        home_label = ${homeLabel}, away_label = ${awayLabel}
    WHERE id = ${params.matchId}
  `;

  return NextResponse.json({
    ok: true,
    homeScore,
    awayScore,
    homeLabel,
    awayLabel,
  });
}
