import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { groupMemberIds, notifySafe } from "@/lib/notifications";
import { heading } from "@/lib/notifyText";

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

  const joined = await sql`
    INSERT INTO group_members (group_id, user_id)
    VALUES (${group.id}, ${session.userId})
    ON CONFLICT (group_id, user_id) DO NOTHING
    RETURNING user_id
  `;

  // Yalnizca GERCEKTEN yeni katilimda haber veriyoruz. Zaten uye olan biri
  // kodu tekrar girerse ON CONFLICT sessizce geciyor; o durumda takima
  // "yeni oyuncu" demek yanlis olurdu.
  if (joined.rowCount && joined.rowCount > 0) {
    const me = await sql`SELECT name FROM users WHERE id = ${session.userId}`;
    const who = (me.rows[0]?.name as string | undefined) ?? "Yeni bir oyuncu";
    await notifySafe({
      userIds: await groupMemberIds(group.id as string, session.userId),
      groupId: group.id as string,
      matchId: null,
      kind: "uye_katildi",
      title: heading("Yeni oyuncu", group.name as string),
      body: `${who} takıma katıldı`,
      dedupeKey: `uye_katildi:${group.id}:${session.userId}`,
    });
  }

  return NextResponse.json({ group });
}
