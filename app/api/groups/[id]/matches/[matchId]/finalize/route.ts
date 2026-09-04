import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isGroupOwner } from "@/lib/groupAccess";
import { finalizeMatchOption } from "@/lib/pollClose";

// POST: { optionId } — anketten bir secenegi kesinlestirir ve maci planlar.
// Secenegi isaretleyenler otomatik "katiliyor", "katilamam" diyenler
// otomatik "katilmiyor" olarak yoklamaya yazilir; digerleri bos kalir.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; matchId: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const isOwner = await isGroupOwner(params.id, session.userId);
  if (!isOwner) {
    return NextResponse.json(
      { error: "Bu işlem için grubun yöneticisi olmalısınız." },
      { status: 403 }
    );
  }

  const matchRes = await sql`
    SELECT id, mode, status FROM matches
    WHERE id = ${params.matchId} AND group_id = ${params.id}
  `;
  const match = matchRes.rows[0];
  if (!match) return NextResponse.json({ error: "Maç bulunamadı." }, { status: 404 });
  if (match.mode !== "poll") {
    return NextResponse.json({ error: "Bu maç bir anket değil." }, { status: 400 });
  }
  if (match.status !== "poll_open") {
    return NextResponse.json({ error: "Anket zaten kapatılmış." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const optionId = typeof body?.optionId === "string" ? body.optionId : "";
  if (!optionId) {
    return NextResponse.json({ error: "Bir seçenek seçmelisiniz." }, { status: 400 });
  }

  const optionRes = await sql`
    SELECT id, starts_at, location FROM match_options
    WHERE id = ${optionId} AND match_id = ${params.matchId}
  `;
  const option = optionRes.rows[0];
  if (!option) return NextResponse.json({ error: "Geçersiz seçenek." }, { status: 400 });

  await finalizeMatchOption(params.matchId, {
    id: option.id as string,
    starts_at: option.starts_at as string,
    location: option.location as string,
  });

  return NextResponse.json({
    ok: true,
    scheduledAt: option.starts_at,
    location: option.location,
  });
}
