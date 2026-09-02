import { sql } from "@/lib/db";
import {
  computeMatchAdjustments,
  RATING_DEADLINE_HOURS,
  RatingRow,
} from "@/lib/matchScoring";

// Mac sonuclarinin veritabani katmani. Puanlama matematigi lib/matchScoring.ts.
export {
  NEUTRAL_MATCH_SCORE,
  RATING_DEADLINE_HOURS,
  NO_RATING_PENALTY,
  MIN_MATCH_SCORE,
  MAX_MATCH_SCORE,
  isValidMatchScore,
} from "@/lib/matchScoring";

export type ProcessResult =
  | { processed: false; reason: string }
  | { processed: true; adjustments: number; excluded: string[] };

// Mac oynandiktan sonra, herkes puanlamasini tamamladiysa ya da 24 saat
// gectiyse sonuclari isler. Ayri bir cron gerekmesin diye mac okundugunda ya
// da puanlama gonderildiginde cagrilir; islenmis maci tekrar islemez.
export async function maybeProcessMatchRatings(
  matchId: string
): Promise<ProcessResult> {
  const matchRes = await sql`
    SELECT id, group_id, status, scheduled_at, ratings_processed_at
    FROM matches WHERE id = ${matchId}
  `;
  const match = matchRes.rows[0];
  if (!match) return { processed: false, reason: "not_found" };
  if (match.ratings_processed_at) {
    return { processed: false, reason: "already_processed" };
  }
  if (match.status !== "scheduled") return { processed: false, reason: "not_scheduled" };
  if (!match.scheduled_at) return { processed: false, reason: "no_date" };

  const scheduledAt = new Date(match.scheduled_at as string);
  if (scheduledAt.getTime() > Date.now()) {
    return { processed: false, reason: "not_played_yet" };
  }

  const [attendanceRes, ratingsRes] = await Promise.all([
    sql`
      SELECT user_id FROM match_attendance
      WHERE match_id = ${matchId} AND status = 'yes'
    `,
    sql`
      SELECT rater_id, target_id, score, strength_skill, weakness_skill
      FROM match_ratings WHERE match_id = ${matchId}
    `,
  ]);

  const participantIds = attendanceRes.rows.map((r) => r.user_id as string);
  const ratings = ratingsRes.rows as RatingRow[];

  if (participantIds.length < 2) {
    await sql`
      UPDATE matches SET status = 'completed', ratings_processed_at = now()
      WHERE id = ${matchId}
    `;
    return { processed: true, adjustments: 0, excluded: [] };
  }

  // Bir oyuncu, diger tum katilimcilari puanladiysa "tamamlamis" sayilir.
  const participantSet = new Set(participantIds);
  const ratedTargets = new Map<string, Set<string>>();
  for (const rating of ratings) {
    if (!participantSet.has(rating.rater_id) || !participantSet.has(rating.target_id)) {
      continue;
    }
    const set = ratedTargets.get(rating.rater_id) ?? new Set<string>();
    set.add(rating.target_id);
    ratedTargets.set(rating.rater_id, set);
  }

  const required = participantIds.length - 1;
  const incomplete = participantIds.filter(
    (id) => (ratedTargets.get(id)?.size ?? 0) < required
  );

  const deadlinePassed =
    Date.now() >= scheduledAt.getTime() + RATING_DEADLINE_HOURS * 60 * 60 * 1000;

  if (incomplete.length > 0 && !deadlinePassed) {
    return { processed: false, reason: "waiting_for_ratings" };
  }

  const excluded = new Set(incomplete);
  const adjustments = computeMatchAdjustments(participantIds, ratings, excluded);

  if (adjustments.length > 0) {
    // Tek sorguda toplu insert: oyuncu basina ayri insert atmak uzak
    // veritabaninda cok yavas kaliyor.
    const values: string[] = [];
    const params: unknown[] = [];
    adjustments.forEach((adj, index) => {
      const base = index * 6;
      values.push(
        `($${base + 1}::uuid, $${base + 2}::uuid, $${base + 3}::uuid,` +
          ` $${base + 4}::text, $${base + 5}::numeric, $${base + 6}::text)`
      );
      params.push(
        match.group_id,
        adj.userId,
        matchId,
        adj.skill,
        adj.delta,
        adj.reason
      );
    });

    await sql.query(
      `INSERT INTO skill_adjustments
         (group_id, user_id, match_id, skill, delta, reason)
       VALUES ${values.join(", ")}`,
      params
    );
  }

  await sql`
    UPDATE matches SET status = 'completed', ratings_processed_at = now()
    WHERE id = ${matchId}
  `;

  return {
    processed: true,
    adjustments: adjustments.length,
    excluded: [...excluded],
  };
}
