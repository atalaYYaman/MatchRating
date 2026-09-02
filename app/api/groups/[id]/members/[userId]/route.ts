import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

type OwnerResult =
  | { ok: true; group: { id: string; owner_id: string } }
  | { ok: false; error: NextResponse };

async function getOwnedGroup(groupId: string, userId: string): Promise<OwnerResult> {
  const result = await sql`
    SELECT id, owner_id FROM groups WHERE id = ${groupId}
  `;
  const group = result.rows[0] as { id: string; owner_id: string } | undefined;
  if (!group) {
    return { ok: false, error: NextResponse.json({ error: "Takım bulunamadı." }, { status: 404 }) };
  }
  if (group.owner_id !== userId) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: "Bu işlem için grubun yöneticisi olmalısınız." },
        { status: 403 }
      ),
    };
  }
  return { ok: true, group };
}

async function isGroupMember(groupId: string, userId: string) {
  const result = await sql`
    SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId}
  `;
  return result.rows.length > 0;
}

// PATCH: { nickname: string | null } — grup ici takma ad
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const owned = await getOwnedGroup(params.id, session.userId);
  if (!owned.ok) return owned.error;

  if (!(await isGroupMember(params.id, params.userId))) {
    return NextResponse.json({ error: "Bu kişi grupta değil." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const raw = body?.nickname;
  let nickname: string | null = null;
  if (raw != null && String(raw).trim() !== "") {
    nickname = String(raw).trim();
    if (nickname.length < 2 || nickname.length > 40) {
      return NextResponse.json(
        { error: "Takma ad 2-40 karakter olmalı." },
        { status: 400 }
      );
    }
  }

  await sql`
    UPDATE group_members
    SET nickname = ${nickname}
    WHERE group_id = ${params.id} AND user_id = ${params.userId}
  `;

  return NextResponse.json({ ok: true, nickname });
}

// DELETE: uyeyi gruptan cikarir. Iki durumda calisir:
//  - yonetici baska bir uyeyi cikarir,
//  - uye kendi kendini cikarir (gruptan ayrilma).
// Yonetici gruptan ayrilamaz; onun yerine grubu silmesi gerekir.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const groupRes = await sql`SELECT id, owner_id FROM groups WHERE id = ${params.id}`;
  const group = groupRes.rows[0];
  if (!group) return NextResponse.json({ error: "Takım bulunamadı." }, { status: 404 });

  const isSelf = params.userId === session.userId;
  const isOwner = group.owner_id === session.userId;

  if (!isSelf && !isOwner) {
    return NextResponse.json(
      { error: "Bu işlem için grubun yöneticisi olmalısınız." },
      { status: 403 }
    );
  }

  if (params.userId === group.owner_id) {
    return NextResponse.json(
      {
        error: isSelf
          ? "Yönetici takımdan ayrılamaz. Takımı silebilirsin."
          : "Yönetici gruptan çıkarılamaz.",
      },
      { status: 400 }
    );
  }

  if (!(await isGroupMember(params.id, params.userId))) {
    return NextResponse.json({ error: "Bu kişi grupta değil." }, { status: 404 });
  }

  await sql`
    DELETE FROM votes
    WHERE group_id = ${params.id} AND (voter_id = ${params.userId} OR target_id = ${params.userId})
  `;
  await sql`
    DELETE FROM position_votes
    WHERE group_id = ${params.id} AND (voter_id = ${params.userId} OR target_id = ${params.userId})
  `;
  await sql`
    DELETE FROM group_members
    WHERE group_id = ${params.id} AND user_id = ${params.userId}
  `;

  return NextResponse.json({ ok: true });
}
