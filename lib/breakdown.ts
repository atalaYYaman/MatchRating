import { sql } from "@/lib/db";
import { SKILL_KEYS } from "@/lib/skills";
import { aggregateScores } from "@/lib/scoring";

export type SkillVoteDetail = {
  voterId: string;
  voterName: string;
  score: number;
};

export type PositionVoteDetail = {
  voterId: string;
  voterName: string;
  primary: string;
  secondary: string;
};

export type SkillBreakdown = {
  average: number | null;
  voteCount: number;
  votes: SkillVoteDetail[];
};

export type PlayerBreakdown = {
  userId: string;
  name: string;
  voteCount: number;
  skills: Record<string, SkillBreakdown>;
  positions: PositionVoteDetail[];
};

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export async function computeGroupBreakdown(groupId: string): Promise<PlayerBreakdown[]> {
  const [members, voteRows, positionVoteRows] = await Promise.all([
    sql`
      SELECT u.id, COALESCE(NULLIF(BTRIM(gm.nickname), ''), u.name) AS name
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ${groupId}
      ORDER BY name ASC
    `,
    sql`
      SELECT
        v.target_id,
        v.voter_id,
        v.skill,
        v.score,
        COALESCE(NULLIF(BTRIM(gm.nickname), ''), u.name) AS voter_name
      FROM votes v
      JOIN users u ON u.id = v.voter_id
      LEFT JOIN group_members gm
        ON gm.group_id = v.group_id AND gm.user_id = v.voter_id
      WHERE v.group_id = ${groupId}
    `,
    sql`
      SELECT
        pv.target_id,
        pv.voter_id,
        pv.primary_position,
        pv.secondary_position,
        COALESCE(NULLIF(BTRIM(gm.nickname), ''), u.name) AS voter_name
      FROM position_votes pv
      JOIN users u ON u.id = pv.voter_id
      LEFT JOIN group_members gm
        ON gm.group_id = pv.group_id AND gm.user_id = pv.voter_id
      WHERE pv.group_id = ${groupId}
    `,
  ]);

  const votesByTarget = new Map<string, Map<string, SkillVoteDetail[]>>();
  for (const row of voteRows.rows) {
    const targetId = row.target_id as string;
    const skill = row.skill as string;
    const score = Number(row.score);
    if (!Number.isFinite(score)) continue;
    if (!votesByTarget.has(targetId)) votesByTarget.set(targetId, new Map());
    const bySkill = votesByTarget.get(targetId)!;
    if (!bySkill.has(skill)) bySkill.set(skill, []);
    bySkill.get(skill)!.push({
      voterId: row.voter_id as string,
      voterName: (row.voter_name as string) || "Bilinmeyen",
      score,
    });
  }

  const positionsByTarget = new Map<string, PositionVoteDetail[]>();
  for (const row of positionVoteRows.rows) {
    const targetId = row.target_id as string;
    const list = positionsByTarget.get(targetId) || [];
    list.push({
      voterId: row.voter_id as string,
      voterName: (row.voter_name as string) || "Bilinmeyen",
      primary: row.primary_position as string,
      secondary: row.secondary_position as string,
    });
    positionsByTarget.set(targetId, list);
  }

  return members.rows.map((m) => {
    const userId = m.id as string;
    const skillVotes = votesByTarget.get(userId);
    const skills: Record<string, SkillBreakdown> = {};
    let voteCount = 0;

    for (const key of SKILL_KEYS) {
      const votes = [...(skillVotes?.get(key) ?? [])].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.voterName.localeCompare(b.voterName, "tr");
      });
      voteCount = Math.max(voteCount, votes.length);
      const aggregated = aggregateScores(votes.map((v) => v.score));
      skills[key] = {
        average: votes.length > 0 ? round1(aggregated.value) : null,
        voteCount: votes.length,
        votes,
      };
    }

    const positions = [...(positionsByTarget.get(userId) ?? [])].sort((a, b) =>
      a.voterName.localeCompare(b.voterName, "tr")
    );

    return {
      userId,
      name: m.name as string,
      voteCount,
      skills,
      positions,
    };
  });
}
