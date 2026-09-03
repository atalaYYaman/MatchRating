import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { computeGroupRecords } from "@/lib/records";
import { getActiveSeason } from "@/lib/seasons";

async function assertMember(groupId: string, userId: string) {
  const result = await sql`
    SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId}
  `;
  return result.rows.length > 0;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  // Sorgular birbirinden bagimsiz; ardisik degil paralel calistirarak
  // uzak veritabanina gidiş-dönüş sayisini azaltiyoruz. G-B-M kaydi aktif
  // sezona gore hesaplanir.
  const season = await getActiveSeason(params.id);
  const [isMember, groupResult, membersResult, records] = await Promise.all([
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
    computeGroupRecords(params.id, season.id),
  ]);

  if (!isMember) return NextResponse.json({ error: "Bu takıma erişiminiz yok." }, { status: 403 });

  const group = groupResult.rows[0];
  if (!group) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 404 });

  const emptyRecord = { played: 0, wins: 0, draws: 0, losses: 0 };
  const members = membersResult.rows.map((m) => ({
    ...m,
    record: records.get(m.id as string) ?? emptyRecord,
  }));

  return NextResponse.json({
    group,
    members,
    activeSeason: { id: season.id, name: season.name },
    // Istemci "takimdan ayril" icin kendi uyelik satirini hedefliyor.
    meId: session.userId,
    isOwner: group.owner_id === session.userId,
    ratingsBreakdownPublic:
      group.ratings_breakdown_public === true || group.ratings_breakdown_public === "t",
  });
}

// DELETE: takimi tamamen siler. Yalnizca yonetici yapabilir; uyelikler,
// oylar, maclar ve puan duzeltmeleri sema tarafindaki ON DELETE CASCADE ile
// birlikte gider.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const groupResult = await sql`
    SELECT id, owner_id, name FROM groups WHERE id = ${params.id}
  `;
  const group = groupResult.rows[0];
  if (!group) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 404 });
  if (group.owner_id !== session.userId) {
    return NextResponse.json(
      { error: "Takımı yalnızca yöneticisi silebilir." },
      { status: 403 }
    );
  }

  await sql`DELETE FROM groups WHERE id = ${params.id}`;
  return NextResponse.json({ ok: true });
}
