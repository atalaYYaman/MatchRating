import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/admin";

const STATUSES = ["yeni", "okundu", "kapandi"] as const;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!isPlatformAdmin(session)) {
    return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  }

  const status = req.nextUrl.searchParams.get("status");
  const filter = STATUSES.includes(status as (typeof STATUSES)[number]) ? status : null;

  const res = await sql`
    SELECT f.id, f.kind, f.message, f.app, f.status, f.created_at,
           f.user_name, f.user_email, f.user_id,
           g.name AS group_name
    FROM feedback f
    LEFT JOIN groups g ON g.id = f.group_id
    WHERE (${filter}::text IS NULL OR f.status = ${filter})
    ORDER BY f.created_at DESC
    LIMIT 200
  `;
  return NextResponse.json({ feedback: res.rows });
}

// PATCH: { id, status } — okundu / kapandi isaretleme.
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!isPlatformAdmin(session)) {
    return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : null;
  const status = STATUSES.includes(body?.status) ? body.status : null;
  if (!id || !status) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  await sql`UPDATE feedback SET status = ${status} WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
