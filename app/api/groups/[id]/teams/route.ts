import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { SKILL_KEYS } from "@/lib/skills";
import { DEFAULT_SCORE } from "@/lib/scoring";
import { generateBalancedTeams } from "@/lib/teamBalancer";

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

  const members = await sql`
    SELECT u.id, u.name
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = ${params.id}
  `;

  const memberIds = new Set(members.rows.map((m) => m.id as string));
  let selected = members.rows;

  if (Array.isArray(body?.playerIds)) {
    const requested = (body.playerIds as unknown[])
      .filter((id): id is string => typeof id === "string")
      .filter((id) => memberIds.has(id));
    const requestedSet = new Set(requested);
    selected = members.rows.filter((m) => requestedSet.has(m.id as string));
  }

  if (selected.length < teamCount) {
    return NextResponse.json(
      { error: `Takım sayısı, seçilen oyuncu sayısından (${selected.length}) fazla olamaz.` },
      { status: 400 }
    );
  }

  const skillAverages = await sql`
    SELECT target_id, skill, AVG(score)::float AS avg_score
    FROM votes
    WHERE group_id = ${params.id}
    GROUP BY target_id, skill
  `;

  const byTarget = new Map<string, Record<string, number>>();
  for (const row of skillAverages.rows) {
    const targetId = row.target_id as string;
    if (!byTarget.has(targetId)) byTarget.set(targetId, {});
    byTarget.get(targetId)![row.skill as string] = row.avg_score as number;
  }

  const players = selected.map((m) => {
    const skills = byTarget.get(m.id) || {};
    let sum = 0;
    for (const key of SKILL_KEYS) sum += skills[key] ?? DEFAULT_SCORE;
    return {
      userId: m.id as string,
      name: m.name as string,
      overall: Math.round((sum / SKILL_KEYS.length) * 10) / 10,
    };
  });

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
    })),
  });
}
