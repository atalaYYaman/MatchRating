import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET  -> son bildirimler + okunmamis sayisi
// PATCH { id? } -> id verilirse o bildirimi, verilmezse hepsini okundu yap
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const [list, unread] = await Promise.all([
    sql`
      SELECT n.id, n.kind, n.title, n.body, n.group_id, n.match_id,
             n.read_at, n.created_at, g.name AS group_name
      FROM notifications n
      LEFT JOIN groups g ON g.id = n.group_id
      WHERE n.user_id = ${session.userId}
      ORDER BY n.created_at DESC
      LIMIT 50
    `,
    sql`
      SELECT count(*)::int AS c FROM notifications
      WHERE user_id = ${session.userId} AND read_at IS NULL
    `,
  ]);

  return NextResponse.json({
    notifications: list.rows,
    unread: Number(unread.rows[0]?.c ?? 0),
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : null;

  if (id) {
    await sql`
      UPDATE notifications SET read_at = now()
      WHERE id = ${id} AND user_id = ${session.userId} AND read_at IS NULL
    `;
  } else {
    await sql`
      UPDATE notifications SET read_at = now()
      WHERE user_id = ${session.userId} AND read_at IS NULL
    `;
  }
  return NextResponse.json({ ok: true });
}
