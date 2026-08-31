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

  // Uc sorgu birbirinden bagimsiz; ardisik degil paralel calistirarak
  // uzak veritabanina gidiş-dönüş sayisini 3'ten 1'e indiriyoruz.
  const [isMember, groupResult, membersResult] = await Promise.all([
    assertMember(params.id, session.userId),
    sql`
      SELECT id, name, invite_code, owner_id, ratings_breakdown_public, created_at
      FROM groups WHERE id = ${params.id}
    `,
    sql`
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
    `,
  ]);

  if (!isMember) return NextResponse.json({ error: "Bu takıma erişiminiz yok." }, { status: 403 });

  const group = groupResult.rows[0];
  if (!group) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 404 });

  return NextResponse.json({
    group,
    members: membersResult.rows,
    isOwner: group.owner_id === session.userId,
    ratingsBreakdownPublic:
      group.ratings_breakdown_public === true || group.ratings_breakdown_public === "t",
  });
}
