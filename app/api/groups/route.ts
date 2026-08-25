import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

function generateInviteCode() {
  // Kolay okunur / paylaşılır 6 haneli kod (belirsiz karakterler haric)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const result = await sql`
    SELECT g.id, g.name, g.invite_code, g.owner_id, g.created_at,
           COUNT(gm2.user_id)::int AS member_count
    FROM groups g
    JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ${session.userId}
    LEFT JOIN group_members gm2 ON gm2.group_id = g.id
    GROUP BY g.id
    ORDER BY g.created_at DESC
  `;

  return NextResponse.json({ groups: result.rows });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const { name } = await req.json();
  if (!name || String(name).trim().length < 2) {
    return NextResponse.json({ error: "Takım adı en az 2 karakter olmalı." }, { status: 400 });
  }

  let inviteCode = generateInviteCode();
  // Kod çakışmasına karşı birkaç kez dene
  for (let i = 0; i < 5; i++) {
    const existing = await sql`SELECT 1 FROM groups WHERE invite_code = ${inviteCode}`;
    if (existing.rows.length === 0) break;
    inviteCode = generateInviteCode();
  }

  const result = await sql`
    INSERT INTO groups (name, invite_code, owner_id)
    VALUES (${String(name).trim()}, ${inviteCode}, ${session.userId})
    RETURNING id, name, invite_code, owner_id, created_at
  `;
  const group = result.rows[0];

  await sql`
    INSERT INTO group_members (group_id, user_id) VALUES (${group.id}, ${session.userId})
  `;

  return NextResponse.json({ group });
}
