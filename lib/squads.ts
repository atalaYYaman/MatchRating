import { sql } from "@/lib/db";
import { computeGroupRatings } from "@/lib/ratings";
import { generateBalancedTeams, RatedPlayer } from "@/lib/teamBalancer";
import { isPositionKey } from "@/lib/positions";
import { isValidScore } from "@/lib/scoring";

export type SquadSide = "home" | "away";

export type SquadPlayer = {
  id: string;
  userId: string | null;
  name: string;
  isGuest: boolean;
  overall: number;
  primaryPosition: string | null;
  secondaryPosition: string | null;
};

export type SquadResult = {
  locked: boolean;
  home: SquadPlayer[];
  away: SquadPlayer[];
};

export type GuestInput = {
  name: string;
  overall: number;
  primaryPosition?: string | null;
  secondaryPosition?: string | null;
};

const MAX_GUESTS = 20;

export function parseGuestInputs(raw: unknown): GuestInput[] {
  if (!Array.isArray(raw)) return [];
  const guests: GuestInput[] = [];
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
    guests.push({ name, overall, primaryPosition: primary, secondaryPosition: secondary });
  }
  return guests;
}

// Kadrolari kayitli uye adlariyla (canli) doldurup dondurur.
export async function getMatchSquads(matchId: string): Promise<SquadResult | null> {
  const [matchRes, squadsRes, playersRes] = await Promise.all([
    sql`SELECT squads_locked_at FROM matches WHERE id = ${matchId}`,
    sql`SELECT id, side FROM match_squads WHERE match_id = ${matchId}`,
    sql`
      SELECT sp.id, sp.squad_id, sp.user_id, sp.guest_name, sp.overall,
             sp.primary_position, sp.secondary_position,
             COALESCE(NULLIF(BTRIM(gm.nickname), ''), u.name) AS user_name
      FROM match_squad_players sp
      LEFT JOIN users u ON u.id = sp.user_id
      LEFT JOIN group_members gm
        ON gm.user_id = sp.user_id
       AND gm.group_id = (SELECT group_id FROM matches WHERE id = ${matchId})
      WHERE sp.match_id = ${matchId}
      ORDER BY sp.created_at ASC
    `,
  ]);

  const match = matchRes.rows[0];
  if (!match || squadsRes.rows.length === 0) return null;

  const squadIdToSide = new Map<string, SquadSide>();
  for (const row of squadsRes.rows) {
    squadIdToSide.set(row.id as string, row.side as SquadSide);
  }

  const home: SquadPlayer[] = [];
  const away: SquadPlayer[] = [];
  for (const row of playersRes.rows) {
    const side = squadIdToSide.get(row.squad_id as string);
    if (!side) continue;
    const player: SquadPlayer = {
      id: row.id as string,
      userId: (row.user_id as string) ?? null,
      name: row.user_id ? (row.user_name as string) : (row.guest_name as string),
      isGuest: !row.user_id,
      overall: Number(row.overall),
      primaryPosition: (row.primary_position as string) ?? null,
      secondaryPosition: (row.secondary_position as string) ?? null,
    };
    (side === "home" ? home : away).push(player);
  }

  return { locked: match.squads_locked_at !== null, home, away };
}

// Katilimcilardan (+ misafirler) rastgele dengeli iki kadro uretip kaydeder.
// Kilitliyken cagrilamaz; onceki kadrolarin uzerine yazar.
export async function generateMatchSquads(
  groupId: string,
  matchId: string,
  guests: GuestInput[]
): Promise<SquadResult> {
  const [attendanceRes, ratings] = await Promise.all([
    sql`SELECT user_id FROM match_attendance WHERE match_id = ${matchId} AND status = 'yes'`,
    computeGroupRatings(groupId),
  ]);

  const attendeeIds = new Set(attendanceRes.rows.map((r) => r.user_id as string));
  const ratingByUser = new Map(ratings.map((r) => [r.userId, r]));

  const players: RatedPlayer[] = [];
  for (const userId of attendeeIds) {
    const r = ratingByUser.get(userId);
    players.push({
      userId,
      name: r?.name ?? "Oyuncu",
      overall: r?.overall ?? 75,
      primaryPosition: r?.primaryPosition ?? null,
      secondaryPosition: r?.secondaryPosition ?? null,
    });
  }
  const guestPlayers: RatedPlayer[] = guests.map((g) => ({
    userId: `guest-${crypto.randomUUID()}`,
    name: g.name,
    overall: g.overall,
    primaryPosition: g.primaryPosition ?? null,
    secondaryPosition: g.secondaryPosition ?? null,
  }));
  const guestIds = new Set(guestPlayers.map((g) => g.userId));

  const all = [...players, ...guestPlayers];
  if (all.length < 2) {
    throw new Error("Kadro oluşturmak için en az 2 oyuncu (yoklama + misafir) gerekli.");
  }

  const teams = generateBalancedTeams(all, 2);
  const [homeTeam, awayTeam] = teams;

  await sql`DELETE FROM match_squads WHERE match_id = ${matchId}`;

  const homeSquad = await sql`
    INSERT INTO match_squads (match_id, side) VALUES (${matchId}, 'home') RETURNING id
  `;
  const awaySquad = await sql`
    INSERT INTO match_squads (match_id, side) VALUES (${matchId}, 'away') RETURNING id
  `;
  const squadIdBySide: Record<SquadSide, string> = {
    home: homeSquad.rows[0].id as string,
    away: awaySquad.rows[0].id as string,
  };

  const rows: { squadId: string; player: RatedPlayer }[] = [
    ...homeTeam.players.map((p) => ({ squadId: squadIdBySide.home, player: p })),
    ...awayTeam.players.map((p) => ({ squadId: squadIdBySide.away, player: p })),
  ];

  if (rows.length > 0) {
    const values: string[] = [];
    const params: unknown[] = [];
    rows.forEach(({ squadId, player }, index) => {
      const base = index * 7;
      const isGuest = guestIds.has(player.userId);
      values.push(
        `($${base + 1}::uuid, $${base + 2}::uuid, $${base + 3}::uuid, $${base + 4}::text,` +
          ` $${base + 5}::smallint, $${base + 6}::text, $${base + 7}::text)`
      );
      params.push(
        squadId,
        matchId,
        isGuest ? null : player.userId,
        isGuest ? player.name : null,
        Math.round(player.overall),
        player.primaryPosition,
        player.secondaryPosition
      );
    });

    await sql.query(
      `INSERT INTO match_squad_players
         (squad_id, match_id, user_id, guest_name, overall, primary_position, secondary_position)
       VALUES ${values.join(", ")}`,
      params
    );
  }

  const result = await getMatchSquads(matchId);
  if (!result) throw new Error("Kadro kaydedildi ama okunamadı.");
  return result;
}

// Bir oyuncuyu diger tarafa tasir. Kilitliyken cagrilamaz.
export async function moveSquadPlayer(
  matchId: string,
  playerId: string,
  toSide: SquadSide
): Promise<SquadResult> {
  const squadRes = await sql`
    SELECT id FROM match_squads WHERE match_id = ${matchId} AND side = ${toSide}
  `;
  const targetSquad = squadRes.rows[0];
  if (!targetSquad) throw new Error("Hedef kadro bulunamadı.");

  await sql`
    UPDATE match_squad_players SET squad_id = ${targetSquad.id}
    WHERE id = ${playerId} AND match_id = ${matchId}
  `;

  const result = await getMatchSquads(matchId);
  if (!result) throw new Error("Kadro bulunamadı.");
  return result;
}

export async function setSquadsLocked(
  matchId: string,
  locked: boolean
): Promise<void> {
  await sql`
    UPDATE matches SET squads_locked_at = ${locked ? new Date().toISOString() : null}
    WHERE id = ${matchId}
  `;
}
