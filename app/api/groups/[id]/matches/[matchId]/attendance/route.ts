import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isGroupMember } from "@/lib/groupAccess";

// POST: { status: 'yes' | 'no' } — kesinlesmis mac icin yoklama.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; matchId: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const [isMember, matchRes] = await Promise.all([
    isGroupMember(params.id, session.userId),
    sql`
      SELECT id, status, scheduled_at FROM matches
      WHERE id = ${params.matchId} AND group_id = ${params.id}
    `,
  ]);

  if (!isMember) {
    return NextResponse.json({ error: "Bu takıma erişiminiz yok." }, { status: 403 });
  }
  const match = matchRes.rows[0];
  if (!match) return NextResponse.json({ error: "Maç bulunamadı." }, { status: 404 });
  if (match.status !== "scheduled") {
    return NextResponse.json(
      { error: "Bu maç için yoklama alınmıyor." },
      { status: 400 }
    );
  }
  if (
    match.scheduled_at &&
    new Date(match.scheduled_at as string).getTime() <= Date.now()
  ) {
    return NextResponse.json(
      { error: "Maç saati geçtiği için yoklama değiştirilemez." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const status = body?.status;
  if (status !== "yes" && status !== "no") {
    return NextResponse.json({ error: "Geçersiz yoklama durumu." }, { status: 400 });
  }

  await sql`
    INSERT INTO match_attendance (match_id, user_id, status)
    VALUES (${params.matchId}, ${session.userId}, ${status})
    ON CONFLICT (match_id, user_id)
    DO UPDATE SET status = EXCLUDED.status, updated_at = now()
  `;

  return NextResponse.json({ ok: true, status });
}
