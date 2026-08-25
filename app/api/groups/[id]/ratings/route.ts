import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { SKILL_KEYS } from "@/lib/skills";
import { DEFAULT_SCORE } from "@/lib/scoring";

async function assertMember(groupId: string, userId: string) {
  const result = await sql`
    SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId}
  `;
  return result.rows.length > 0;
}

// Her uye icin: 6 yetenegin ortalamasi + genel ortalama (aldiklari oylara gore)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const isMember = await assertMember(params.id, session.userId);
  if (!isMember) return NextResponse.json({ error: "Bu takıma erişiminiz yok." }, { status: 403 });

  const members = await sql`
    SELECT u.id, u.name
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = ${params.id}
  `;

  const skillAverages = await sql`
    SELECT target_id, skill, AVG(score)::float AS avg_score, COUNT(*)::int AS vote_count
    FROM votes
    WHERE group_id = ${params.id}
    GROUP BY target_id, skill
  `;

  const byTarget = new Map<string, Record<string, number>>();
  const voteCounts = new Map<string, number>();
  for (const row of skillAverages.rows) {
    const targetId = row.target_id as string;
    if (!byTarget.has(targetId)) byTarget.set(targetId, {});
    byTarget.get(targetId)![row.skill as string] = row.avg_score as number;
    voteCounts.set(targetId, Math.max(voteCounts.get(targetId) || 0, row.vote_count as number));
  }

  const ratings = members.rows.map((m) => {
    const skills = byTarget.get(m.id) || {};
    const perSkill: Record<string, number> = {};
    let sum = 0;
    for (const key of SKILL_KEYS) {
      const val = skills[key] ?? DEFAULT_SCORE;
      perSkill[key] = Math.round(val * 10) / 10;
      sum += val;
    }
    const overall = Math.round((sum / SKILL_KEYS.length) * 10) / 10;
    return {
      userId: m.id,
      name: m.name,
      skills: perSkill,
      overall,
      voteCount: voteCounts.get(m.id) || 0,
      hasVotes: byTarget.has(m.id),
    };
  });

  ratings.sort((a, b) => b.overall - a.overall);

  return NextResponse.json({ ratings });
}
