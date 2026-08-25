import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function assertMember(groupId: string, userId: string) {
  const result = await sql`
    SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId}
  `;
  return result.rows.length > 0;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const isMember = await assertMember(params.id, session.userId);
  if (!isMember) return NextResponse.json({ error: "Bu takıma erişiminiz yok." }, { status: 403 });

  const groupResult = await sql`
    SELECT id, name, invite_code, owner_id, created_at FROM groups WHERE id = ${params.id}
  `;
  const group = groupResult.rows[0];
  if (!group) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 404 });

  const membersResult = await sql`
    SELECT u.id,
           u.name AS account_name,
           u.email,
           gm.nickname,
           gm.joined_at,
           COALESCE(NULLIF(BTRIM(gm.nickname), ''), u.name) AS name
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = ${params.id}
    ORDER BY gm.joined_at ASC
  `;

  return NextResponse.json({
    group,
    members: membersResult.rows,
    isOwner: group.owner_id === session.userId,
  });
}
