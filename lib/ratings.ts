import { sql } from "@/lib/db";
import { SKILL_KEYS } from "@/lib/skills";
import { positionsByTarget } from "@/lib/positions";
import { aggregateScores, MIN_VOTES_FOR_RELIABLE } from "@/lib/scoring";

export type GroupRating = {
  userId: string;
  name: string;
  skills: Record<string, number>;
  overall: number;
  voteCount: number;
  hasVotes: boolean;
  hasEnoughVotes: boolean;
  primaryPosition: string | null;
  secondaryPosition: string | null;
};

// Oy tabanli temel puan bu araliga kirpilir; mac duzeltmeleri uzun vadede
// puani asiri uclara tasimasin diye.
export const MIN_FINAL_SCORE = 30;
export const MAX_FINAL_SCORE = 99;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export async function computeGroupRatings(groupId: string): Promise<GroupRating[]> {
  const [members, voteRows, positionVoteRows, adjustmentRows] = await Promise.all([
    sql`
      SELECT u.id, COALESCE(NULLIF(BTRIM(gm.nickname), ''), u.name) AS name
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ${groupId}
    `,
    sql`
      SELECT target_id, skill, score
      FROM votes
      WHERE group_id = ${groupId}
    `,
    sql`
      SELECT target_id, primary_position, secondary_position
      FROM position_votes
      WHERE group_id = ${groupId}
    `,
    sql`
      SELECT user_id, skill, SUM(delta)::float8 AS total
      FROM skill_adjustments
      WHERE group_id = ${groupId}
      GROUP BY user_id, skill
    `,
  ]);

  // Mac sonuclarindan gelen duzeltmeler: (user, skill) -> toplam delta
  const adjustments = new Map<string, number>();
  for (const row of adjustmentRows.rows) {
    adjustments.set(`${row.user_id}:${row.skill}`, Number(row.total) || 0);
  }

  const votesByTarget = new Map<string, Map<string, number[]>>();
  for (const row of voteRows.rows) {
    const targetId = row.target_id as string;
    const skill = row.skill as string;
    const score = Number(row.score);
    if (!Number.isFinite(score)) continue;
    if (!votesByTarget.has(targetId)) votesByTarget.set(targetId, new Map());
    const bySkill = votesByTarget.get(targetId)!;
    if (!bySkill.has(skill)) bySkill.set(skill, []);
    bySkill.get(skill)!.push(score);
  }

  const positions = positionsByTarget(
    positionVoteRows.rows as {
      target_id: string;
      primary_position: string;
      secondary_position: string;
    }[]
  );

  const ratings = members.rows.map((m) => {
    const skillVotes = votesByTarget.get(m.id as string);
    let voteCount = 0;
    if (skillVotes) {
      for (const scores of skillVotes.values()) {
        voteCount = Math.max(voteCount, scores.length);
      }
    }

    const perSkill: Record<string, number> = {};
    let sum = 0;
    for (const key of SKILL_KEYS) {
      const { value } = aggregateScores(skillVotes?.get(key) ?? []);
      const adjusted = clamp(
        value + (adjustments.get(`${m.id}:${key}`) ?? 0),
        MIN_FINAL_SCORE,
        MAX_FINAL_SCORE
      );
      perSkill[key] = Math.round(adjusted * 10) / 10;
      sum += adjusted;
    }

    const pos = positions.get(m.id as string);
    return {
      userId: m.id as string,
      name: m.name as string,
      skills: perSkill,
      overall: Math.round((sum / SKILL_KEYS.length) * 10) / 10,
      voteCount,
      hasVotes: voteCount > 0,
      hasEnoughVotes: voteCount >= MIN_VOTES_FOR_RELIABLE,
      primaryPosition: pos?.primary ?? null,
      secondaryPosition: pos?.secondary ?? null,
    };
  });

  ratings.sort((a, b) => b.overall - a.overall);
  return ratings;
}
