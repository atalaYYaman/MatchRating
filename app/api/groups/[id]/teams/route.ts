import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generateBalancedTeams } from "@/lib/teamBalancer";
import { POSITIONS } from "@/lib/positions";
import { computeGroupRatings } from "@/lib/ratings";

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

  if (selected.length < teamCount) {
    return NextResponse.json(
      { error: `Takım sayısı, seçilen oyuncu sayısından (${selected.length}) fazla olamaz.` },
      { status: 400 }
    );
  }

  // Eşik altı oyuncular da kendi (az güvenilir) ortalamalarıyla katılır; 75'e düşürülmez.
  const players = selected.map((r) => ({
    userId: r.userId,
    name: r.name,
    overall: r.overall,
    primaryPosition: r.primaryPosition,
    secondaryPosition: r.secondaryPosition,
  }));

  const teams = generateBalancedTeams(players, teamCount);

  return NextResponse.json({
    teams: teams.map((t) => ({
      index: t.index,
      players: t.players,
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
