import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { computeGroupBreakdown } from "@/lib/breakdown";

function asBool(value: unknown) {
  return value === true || value === "t" || value === "true";
}

async function assertMember(groupId: string, userId: string) {
  const result = await sql`
    SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId}
  `;
  return result.rows.length > 0;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const [isMember, groupResult] = await Promise.all([
    assertMember(params.id, session.userId),
    sql`SELECT owner_id, ratings_breakdown_public FROM groups WHERE id = ${params.id}`,
  ]);
  if (!isMember) return NextResponse.json({ error: "Bu takıma erişiminiz yok." }, { status: 403 });

  const group = groupResult.rows[0];
  if (!group) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 404 });

  const isOwner = group.owner_id === session.userId;
  const ratingsBreakdownPublic = asBool(group.ratings_breakdown_public);
  if (!isOwner && !ratingsBreakdownPublic) {
    return NextResponse.json(
      { error: "Puan detayları şu an sadece yöneticiye açık.", ratingsBreakdownPublic: false, isOwner },
      { status: 403 }
    );
  }

  const players = await computeGroupBreakdown(params.id);
  return NextResponse.json({
    players,
    isOwner,
    ratingsBreakdownPublic,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const groupResult = await sql`
    SELECT owner_id FROM groups WHERE id = ${params.id}
  `;
  const group = groupResult.rows[0];
  if (!group) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 404 });
  if (group.owner_id !== session.userId) {
    return NextResponse.json({ error: "Sadece yönetici bu ayarı değiştirebilir." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body?.public !== "boolean") {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  await sql`
    UPDATE groups
    SET ratings_breakdown_public = ${body.public}
    WHERE id = ${params.id}
  `;

  return NextResponse.json({ ok: true, ratingsBreakdownPublic: body.public });
}
