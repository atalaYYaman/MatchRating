import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const { inviteCode } = await req.json();
  if (!inviteCode) {
    return NextResponse.json({ error: "Davet kodu gerekli." }, { status: 400 });
  }

  const code = String(inviteCode).trim().toUpperCase();
  const groupResult = await sql`SELECT id, name FROM groups WHERE invite_code = ${code}`;
  const group = groupResult.rows[0];
  if (!group) {
    return NextResponse.json({ error: "Geçersiz davet kodu." }, { status: 404 });
  }

  await sql`
    INSERT INTO group_members (group_id, user_id)
    VALUES (${group.id}, ${session.userId})
    ON CONFLICT (group_id, user_id) DO NOTHING
  `;

  return NextResponse.json({ group });
}
