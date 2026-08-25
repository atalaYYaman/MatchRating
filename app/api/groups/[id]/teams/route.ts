import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generateBalancedTeams, RatedPlayer } from "@/lib/teamBalancer";
import { POSITIONS, isPositionKey } from "@/lib/positions";
import { computeGroupRatings } from "@/lib/ratings";
import { isValidScore } from "@/lib/scoring";

const MAX_GUESTS = 20;

function parseGuests(raw: unknown): RatedPlayer[] {
  if (!Array.isArray(raw)) return [];
  const guests: RatedPlayer[] = [];
  const usedIds = new Set<string>();

  for (const item of raw) {
    if (guests.length >= MAX_GUESTS) break;
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim().slice(0, 40) : "";
    if (!name) continue;
    const overall = Math.round(Number(row.overall));
    if (!isValidScore(overall)) continue;
    const primary = isPositionKey(row.primaryPosition) ? row.primaryPosition : null;
    const secondary =
      isPositionKey(row.secondaryPosition) && row.secondaryPosition !== primary
        ? row.secondaryPosition
        : null;

    let userId =
      typeof row.id === "string" && row.id.startsWith("guest-") && !usedIds.has(row.id)
        ? row.id
        : `guest-${crypto.randomUUID()}`;
    usedIds.add(userId);

    guests.push({
      userId,
      name,
      overall,
      primaryPosition: primary,
      secondaryPosition: secondary,
    });
  }

  return guests;
}

async function assertMember(groupId: string, userId: string) {
  const result = await sql`
    SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId}
  `;
  return result.rows.length > 0;
}

// POST: { teamCount: number, playerIds?: string[] } -> rastgele + dengeli takim listesi dondurur (kaydetmez)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const isMember = await assertMember(params.id, session.userId);
  if (!isMember) return NextResponse.json({ error: "Bu takıma erişiminiz yok." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  let teamCount = Number(body?.teamCount) || 2;
  if (teamCount < 2) teamCount = 2;

  const ratings = await computeGroupRatings(params.id);
  const memberIds = new Set(ratings.map((r) => r.userId));
  let selected = ratings;

  if (Array.isArray(body?.playerIds)) {
    const requested = (body.playerIds as unknown[])
      .filter((id): id is string => typeof id === "string")
      .filter((id) => memberIds.has(id));
    const requestedSet = new Set(requested);
    selected = ratings.filter((r) => requestedSet.has(r.userId));
  }

  const guests = parseGuests(body?.guests);

  // Eşik altı oyuncular da kendi (az güvenilir) ortalamalarıyla katılır; 75'e düşürülmez.
  const players: RatedPlayer[] = [
    ...selected.map((r) => ({
      userId: r.userId,
      name: r.name,
      overall: r.overall,
      primaryPosition: r.primaryPosition,
      secondaryPosition: r.secondaryPosition,
    })),
    ...guests,
  ];

  if (players.length < teamCount) {
    return NextResponse.json(
      { error: `Takım sayısı, seçilen oyuncu sayısından (${players.length}) fazla olamaz.` },
      { status: 400 }
    );
  }

  const guestIds = new Set(guests.map((g) => g.userId));
  const teams = generateBalancedTeams(players, teamCount);

  return NextResponse.json({
    teams: teams.map((t) => ({
      index: t.index,
      players: t.players.map((p) => ({ ...p, isGuest: guestIds.has(p.userId) })),
      totalRating: Math.round(t.totalRating * 10) / 10,
      averageRating:
        t.players.length > 0
          ? Math.round((t.totalRating / t.players.length) * 10) / 10
          : 0,
      positionCounts: Object.fromEntries(
        POSITIONS.map((p) => [
          p.key,
          t.players.filter(
            (pl) => pl.primaryPosition === p.key || pl.secondaryPosition === p.key
          ).length,
        ])
      ),
    })),
  });
}
