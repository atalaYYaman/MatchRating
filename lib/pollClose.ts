import { sql } from "@/lib/db";

// Anketin bir secenegini kesinlestirir: maci planlar ve anket cevaplarindan
// yoklamayi onceden doldurur. Hem yoneticinin elle secimi hem de sure dolunca
// calisan otomatik kapanis bu fonksiyonu kullanir.
export async function finalizeMatchOption(
  matchId: string,
  option: { id: string; starts_at: string; location: string }
): Promise<void> {
  await sql`
    UPDATE matches
    SET status = 'scheduled', scheduled_at = ${option.starts_at}, location = ${option.location}
    WHERE id = ${matchId}
  `;

  // Secenegi isaretleyenler "katiliyor".
  await sql`
    INSERT INTO match_attendance (match_id, user_id, status)
    SELECT ${matchId}, v.user_id, 'yes'
    FROM match_poll_option_votes v
    WHERE v.option_id = ${option.id}
    ON CONFLICT (match_id, user_id)
    DO UPDATE SET status = EXCLUDED.status, updated_at = now()
  `;
  // "Hicbirine katilamam" diyenler "katilmiyor".
  await sql`
    INSERT INTO match_attendance (match_id, user_id, status)
    SELECT ${matchId}, r.user_id, 'no'
    FROM match_poll_responses r
    WHERE r.match_id = ${matchId} AND r.available = false
    ON CONFLICT (match_id, user_id) DO NOTHING
  `;
}

export type AutoCloseResult =
  | { closed: false; reason: "not_poll" | "not_open" | "no_deadline" | "not_due" | "no_votes" }
  | { closed: true; optionId: string; startsAt: string; location: string };

// Anket suresi dolduysa en cok oy alan secenegi otomatik kesinlestirir.
// Beraberlikte en erken tarihli secenek kazanir. Hic oy yoksa dokunmaz;
// yonetici elle secsin diye anket acik kalir.
//
// Ayri bir cron gerekmesin diye mac okundugunda cagrilir (puanlama
// islemesindeki maybeProcessMatchRatings ile ayni yaklasim).
export async function maybeAutoClosePoll(matchId: string): Promise<AutoCloseResult> {
  const matchRes = await sql`
    SELECT id, mode, status, poll_closes_at FROM matches WHERE id = ${matchId}
  `;
  const match = matchRes.rows[0];
  if (!match) return { closed: false, reason: "not_poll" };
  if (match.mode !== "poll") return { closed: false, reason: "not_poll" };
  if (match.status !== "poll_open") return { closed: false, reason: "not_open" };
  if (!match.poll_closes_at) return { closed: false, reason: "no_deadline" };
  if (new Date(match.poll_closes_at as string).getTime() > Date.now()) {
    return { closed: false, reason: "not_due" };
  }

  // En cok oy alan secenek; esitlikte en erken tarih.
  const winnerRes = await sql`
    SELECT o.id, o.starts_at, o.location, COUNT(v.user_id)::int AS vote_count
    FROM match_options o
    LEFT JOIN match_poll_option_votes v ON v.option_id = o.id
    WHERE o.match_id = ${matchId}
    GROUP BY o.id, o.starts_at, o.location
    ORDER BY vote_count DESC, o.starts_at ASC
    LIMIT 1
  `;
  const winner = winnerRes.rows[0];
  if (!winner || Number(winner.vote_count) === 0) {
    return { closed: false, reason: "no_votes" };
  }

  await finalizeMatchOption(matchId, {
    id: winner.id as string,
    starts_at: winner.starts_at as string,
    location: winner.location as string,
  });

  return {
    closed: true,
    optionId: winner.id as string,
    startsAt: winner.starts_at as string,
    location: winner.location as string,
  };
}

// Anket suresi doldu mu (henuz kapanmamis olabilir: hic oy yoksa acik kalir).
export function isPollExpired(
  match: { status: string; poll_closes_at: string | null },
  now = Date.now()
): boolean {
  if (match.status !== "poll_open" || !match.poll_closes_at) return false;
  return new Date(match.poll_closes_at).getTime() <= now;
}
