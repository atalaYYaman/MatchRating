import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isGroupMember } from "@/lib/groupAccess";

// POST: { available: boolean, optionIds: string[] }
// available=false ise "hicbir secenege katilamam" demektir, secenekler yok sayilir.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; matchId: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const [isMember, matchRes] = await Promise.all([
    isGroupMember(params.id, session.userId),
    sql`
      SELECT id, mode, status, poll_closes_at FROM matches
      WHERE id = ${params.matchId} AND group_id = ${params.id}
    `,
  ]);

  if (!isMember) {
    return NextResponse.json({ error: "Bu takıma erişiminiz yok." }, { status: 403 });
  }
  const match = matchRes.rows[0];
  if (!match) return NextResponse.json({ error: "Maç bulunamadı." }, { status: 404 });
  if (match.mode !== "poll") {
    return NextResponse.json({ error: "Bu maç bir anket değil." }, { status: 400 });
  }
  if (match.status !== "poll_open") {
    return NextResponse.json({ error: "Anket kapanmış." }, { status: 400 });
  }
  // Anket suresi dolduysa yeni oy alinmaz.
  if (
    match.poll_closes_at &&
    new Date(match.poll_closes_at as string).getTime() <= Date.now()
  ) {
    return NextResponse.json(
      { error: "Anket süresi doldu, oy verilemez." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const available = body?.available === true;
  const optionIds: string[] = Array.isArray(body?.optionIds)
    ? body.optionIds.filter((v: unknown): v is string => typeof v === "string")
    : [];

  if (available && optionIds.length === 0) {
    return NextResponse.json(
      { error: "Katılabileceğin en az bir seçenek seçmelisin." },
      { status: 400 }
    );
  }

  // Gonderilen seceneklerin gercekten bu maca ait oldugunu dogrula.
  let validOptionIds: string[] = [];
  if (available) {
    const optionsRes = await sql`
      SELECT id FROM match_options WHERE match_id = ${params.matchId}
    `;
    const valid = new Set(optionsRes.rows.map((o) => o.id as string));
    validOptionIds = optionIds.filter((id) => valid.has(id));
    if (validOptionIds.length === 0) {
      return NextResponse.json({ error: "Geçersiz seçenek." }, { status: 400 });
    }
  }

  await sql`
    INSERT INTO match_poll_responses (match_id, user_id, available)
    VALUES (${params.matchId}, ${session.userId}, ${available})
    ON CONFLICT (match_id, user_id)
    DO UPDATE SET available = EXCLUDED.available, responded_at = now()
  `;

  // Onceki secimleri temizleyip yenilerini yaz.
  await sql`
    DELETE FROM match_poll_option_votes
    WHERE match_id = ${params.matchId} AND user_id = ${session.userId}
  `;

  if (validOptionIds.length > 0) {
    const values: string[] = [];
    const insertParams: unknown[] = [];
    validOptionIds.forEach((optionId, index) => {
      const base = index * 3;
      values.push(`($${base + 1}::uuid, $${base + 2}::uuid, $${base + 3}::uuid)`);
      insertParams.push(optionId, params.matchId, session.userId);
    });
    await sql.query(
      `INSERT INTO match_poll_option_votes (option_id, match_id, user_id)
       VALUES ${values.join(", ")}`,
      insertParams
    );
  }

  return NextResponse.json({ ok: true });
}
