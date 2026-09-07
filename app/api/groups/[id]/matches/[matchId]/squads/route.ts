import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isGroupMember, isGroupOwner } from "@/lib/groupAccess";
import {
  generateMatchSquads,
  getMatchSquads,
  moveSquadPlayer,
  parseGuestInputs,
  setSquadsLocked,
} from "@/lib/squads";
import { notifySafe } from "@/lib/notifications";
import { groupName, heading, whenLabel, withPlace } from "@/lib/notifyText";

async function loadMatch(groupId: string, matchId: string) {
  const res = await sql`
    SELECT id, match_kind, status, squads_locked_at, scheduled_at, location
    FROM matches
    WHERE id = ${matchId} AND group_id = ${groupId}
  `;
  return res.rows[0] ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; matchId: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const isMember = await isGroupMember(params.id, session.userId);
  if (!isMember) return NextResponse.json({ error: "Bu takıma erişiminiz yok." }, { status: 403 });

  const match = await loadMatch(params.id, params.matchId);
  if (!match) return NextResponse.json({ error: "Maç bulunamadı." }, { status: 404 });

  const squads = await getMatchSquads(params.matchId);
  return NextResponse.json({ squads });
}

// POST: kadrolari (yeniden) uret. { guests?: [...] }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; matchId: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const isOwner = await isGroupOwner(params.id, session.userId);
  if (!isOwner) {
    return NextResponse.json(
      { error: "Bu işlem için grubun yöneticisi olmalısınız." },
      { status: 403 }
    );
  }

  const match = await loadMatch(params.id, params.matchId);
  if (!match) return NextResponse.json({ error: "Maç bulunamadı." }, { status: 404 });
  if (match.match_kind !== "ic") {
    return NextResponse.json(
      { error: "Kadrolar yalnızca takım içi maçlarda oluşturulur." },
      { status: 400 }
    );
  }
  if (match.status === "cancelled") {
    return NextResponse.json({ error: "İptal edilmiş maç." }, { status: 400 });
  }
  if (match.squads_locked_at) {
    return NextResponse.json({ error: "Kadro kilitli; önce kilidi açmalısınız." }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const guests = parseGuestInputs(body?.guests);

  try {
    const squads = await generateMatchSquads(params.id, params.matchId, guests);
    return NextResponse.json({ squads });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kadrolar oluşturulamadı.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// PATCH: { action: 'move', playerId, toSide } | { action: 'lock' | 'unlock' }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; matchId: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const isOwner = await isGroupOwner(params.id, session.userId);
  if (!isOwner) {
    return NextResponse.json(
      { error: "Bu işlem için grubun yöneticisi olmalısınız." },
      { status: 403 }
    );
  }

  const match = await loadMatch(params.id, params.matchId);
  if (!match) return NextResponse.json({ error: "Maç bulunamadı." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  if (action === "lock") {
    await setSquadsLocked(params.matchId, true);
    const squads = await getMatchSquads(params.matchId);

    // Kadro KILITLENINCE haber veriyoruz, kurulunca degil: kilitlenmemis
    // kadro daha degisebilir, herkesi erken uyarip sonra karistirmak
    // bildirimi guvenilmez yapardi.
    const going = await sql`
      SELECT user_id FROM match_attendance
      WHERE match_id = ${params.matchId} AND status = 'yes'
    `;
    await notifySafe({
      userIds: going.rows.map((r) => r.user_id as string),
      groupId: params.id,
      matchId: params.matchId,
      kind: "kadro_hazir",
      title: heading("Kadrolar belli", await groupName(params.id)),
      body: match.scheduled_at
        ? withPlace(
            whenLabel(match.scheduled_at as string),
            match.location as string | null
          )
        : "Takımını görmek için maça gir.",
      dedupeKey: `kadro_hazir:${params.matchId}`,
    });
    return NextResponse.json({ squads });
  }

  if (action === "unlock") {
    await setSquadsLocked(params.matchId, false);
    const squads = await getMatchSquads(params.matchId);
    return NextResponse.json({ squads });
  }

  if (action === "move") {
    if (match.squads_locked_at) {
      return NextResponse.json({ error: "Kadro kilitli; önce kilidi açmalısınız." }, { status: 409 });
    }
    const playerId = typeof body?.playerId === "string" ? body.playerId : null;
    const toSide = body?.toSide === "home" || body?.toSide === "away" ? body.toSide : null;
    if (!playerId || !toSide) {
      return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
    }
    try {
      const squads = await moveSquadPlayer(params.matchId, playerId, toSide);
      return NextResponse.json({ squads });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Oyuncu taşınamadı.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
}
