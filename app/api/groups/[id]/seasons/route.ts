import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isGroupMember, isGroupOwner } from "@/lib/groupAccess";
import { closeActiveSeason, getActiveSeason, listSeasons } from "@/lib/seasons";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const isMember = await isGroupMember(params.id, session.userId);
  if (!isMember) return NextResponse.json({ error: "Bu takıma erişiminiz yok." }, { status: 403 });

  // Aktif sezon yoksa olustur (eski veri / yeni grup guvencesi).
  const active = await getActiveSeason(params.id);
  const seasons = await listSeasons(params.id);

  return NextResponse.json({
    seasons,
    activeSeasonId: active.id,
    isOwner: await isGroupOwner(params.id, session.userId),
  });
}

// POST: aktif sezonu kapatir ve yenisini acar. Yalnizca yonetici.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const isOwner = await isGroupOwner(params.id, session.userId);
  if (!isOwner) {
    return NextResponse.json(
      { error: "Sezonu yalnızca grubun yöneticisi kapatabilir." },
      { status: 403 }
    );
  }

  try {
    const next = await closeActiveSeason(params.id);
    return NextResponse.json({ ok: true, newSeason: { id: next.id, name: next.name } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sezon kapatılamadı.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
