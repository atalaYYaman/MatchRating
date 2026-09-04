import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isGroupMember, isGroupOwner } from "@/lib/groupAccess";
import { maybeProcessMatchRatings } from "@/lib/matchRating";
import { getActiveSeason } from "@/lib/seasons";
import { maybeAutoClosePoll } from "@/lib/pollClose";
import { sweepCancelledMatches } from "@/lib/cancelledSweep";

const MAX_POLL_OPTIONS = 12;
// Anket varsayilan olarak en erken secenegin baslangicina kadar acik kalir.
const DEFAULT_POLL_DAYS = 2;

// Gecerli ISO tarih; gecmisse ya da bozuksa null.
function parseFutureDate(raw: unknown): string | null {
  if (typeof raw !== "string" || Number.isNaN(Date.parse(raw))) return null;
  return new Date(raw).getTime() > Date.now() ? new Date(raw).toISOString() : null;
}

type OptionInput = { startsAt: string; location: string };

function parseOptions(raw: unknown): OptionInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const options: OptionInput[] = [];
  for (const item of raw.slice(0, MAX_POLL_OPTIONS)) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const startsAt = typeof row.startsAt === "string" ? row.startsAt : "";
    const location =
      typeof row.location === "string" ? row.location.trim().slice(0, 120) : "";
    if (!startsAt || Number.isNaN(Date.parse(startsAt)) || !location) return null;
    options.push({ startsAt, location });
  }
  return options.length > 0 ? options : null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  await sweepCancelledMatches();

  const [isMember, matchesRes] = await Promise.all([
    isGroupMember(params.id, session.userId),
    sql`
      SELECT m.id, m.mode, m.match_kind, m.required_players, m.note,
             m.scheduled_at, m.location, m.status, m.ratings_processed_at,
             m.created_at, m.poll_closes_at, m.rsvp_deadline,
             COUNT(DISTINCT a.user_id) FILTER (WHERE a.status = 'yes')::int AS attending_count,
             COUNT(DISTINCT p.user_id)::int AS poll_response_count
      FROM matches m
      LEFT JOIN match_attendance a ON a.match_id = m.id
      LEFT JOIN match_poll_responses p ON p.match_id = m.id
      WHERE m.group_id = ${params.id}
      GROUP BY m.id
      ORDER BY m.created_at DESC
      LIMIT 50
    `,
  ]);

  if (!isMember) {
    return NextResponse.json({ error: "Bu takıma erişiminiz yok." }, { status: 403 });
  }

  // Suresi dolmus anketleri kapat (en cok oy alan kesinlesir). Kapananlar
  // icin satiri tazelemek yerine istemci bir sonraki okumada guncelini alir;
  // burada durumu yerinde guncelliyoruz.
  const expiredPolls = matchesRes.rows.filter(
    (m) =>
      m.status === "poll_open" &&
      m.poll_closes_at &&
      new Date(m.poll_closes_at as string).getTime() <= Date.now()
  );
  if (expiredPolls.length > 0) {
    const closed = await Promise.all(
      expiredPolls.map(async (m) => ({
        id: m.id as string,
        result: await maybeAutoClosePoll(m.id as string),
      }))
    );
    for (const { id, result } of closed) {
      if (!result.closed) continue;
      const row = matchesRes.rows.find((r) => r.id === id);
      if (row) {
        row.status = "scheduled";
        row.scheduled_at = result.startsAt;
        row.location = result.location;
      }
    }
  }

  // Oynanmis ama henuz islenmemis maclar varsa burada isle; ayri bir cron
  // gerekmesin diye.
  const pending = matchesRes.rows.filter(
    (m) =>
      m.status === "scheduled" &&
      m.scheduled_at &&
      new Date(m.scheduled_at as string).getTime() <= Date.now()
  );
  if (pending.length > 0) {
    const results = await Promise.all(
      pending.map(async (m) => ({
        id: m.id as string,
        result: await maybeProcessMatchRatings(m.id as string),
      }))
    );
    const processedIds = new Set(
      results.filter((r) => r.result.processed).map((r) => r.id)
    );
    for (const row of matchesRes.rows) {
      if (processedIds.has(row.id as string)) {
        row.status = "completed";
        row.ratings_processed_at = new Date().toISOString();
      }
    }
  }

  return NextResponse.json({ matches: matchesRes.rows });
}

// POST: yalnizca grup yoneticisi mac olusturabilir.
// poll  -> { mode:'poll', matchKind, requiredPlayers?, note?, options:[{startsAt,location}] }
// fixed -> { mode:'fixed', matchKind, requiredPlayers?, note?, scheduledAt, location }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const isOwner = await isGroupOwner(params.id, session.userId);
  if (!isOwner) {
    return NextResponse.json(
      { error: "Maç oluşturmak için grubun yöneticisi olmalısınız." },
      { status: 403 }
    );
  }

  const season = await getActiveSeason(params.id);

  const body = await req.json().catch(() => ({}));
  const mode = body?.mode;
  const matchKind = body?.matchKind;

  if (mode !== "poll" && mode !== "fixed") {
    return NextResponse.json({ error: "Geçersiz maç tipi." }, { status: 400 });
  }
  if (matchKind !== "ic" && matchKind !== "dis") {
    return NextResponse.json({ error: "İç/dış maç seçmelisiniz." }, { status: 400 });
  }

  const requiredPlayersRaw = Number(body?.requiredPlayers);
  const requiredPlayers =
    Number.isFinite(requiredPlayersRaw) && requiredPlayersRaw > 0
      ? Math.min(Math.round(requiredPlayersRaw), 100)
      : null;
  const note =
    typeof body?.note === "string" && body.note.trim() !== ""
      ? body.note.trim().slice(0, 500)
      : null;

  if (mode === "fixed") {
    const scheduledAt = typeof body?.scheduledAt === "string" ? body.scheduledAt : "";
    const location =
      typeof body?.location === "string" ? body.location.trim().slice(0, 120) : "";
    if (!scheduledAt || Number.isNaN(Date.parse(scheduledAt))) {
      return NextResponse.json({ error: "Geçerli bir tarih/saat girin." }, { status: 400 });
    }
    if (!location) {
      return NextResponse.json({ error: "Konum girmelisiniz." }, { status: 400 });
    }

    // Yoklama son tarihi istege bagli; verilmezse mac saatinde kapanir.
    // Mac saatinden sonraya konamaz.
    const rsvpDeadline = parseFutureDate(body?.rsvpDeadline);
    const kickoff = new Date(scheduledAt).getTime();
    const effectiveRsvp =
      rsvpDeadline && new Date(rsvpDeadline).getTime() < kickoff ? rsvpDeadline : null;

    const result = await sql`
      INSERT INTO matches
        (group_id, created_by, mode, match_kind, required_players, note,
         scheduled_at, location, status, season_id, rsvp_deadline)
      VALUES
        (${params.id}, ${session.userId}, 'fixed', ${matchKind}, ${requiredPlayers},
         ${note}, ${scheduledAt}, ${location}, 'scheduled', ${season.id}, ${effectiveRsvp})
      RETURNING id, mode, match_kind, scheduled_at, location, status, created_at
    `;
    return NextResponse.json({ match: result.rows[0] });
  }

  const options = parseOptions(body?.options);
  if (!options) {
    return NextResponse.json(
      { error: "En az bir geçerli anket seçeneği (tarih + konum) girmelisiniz." },
      { status: 400 }
    );
  }

  // Anket kapanisi: verilmezse 2 gun sonra. Her durumda en erken secenegin
  // baslangicini gecemez (mac saati gectikten sonra anket anlamsiz olur).
  const earliestOption = options
    .map((o) => new Date(o.startsAt).getTime())
    .reduce((min, t) => Math.min(min, t), Infinity);
  const requestedClose = parseFutureDate(body?.pollClosesAt);
  const defaultClose = Date.now() + DEFAULT_POLL_DAYS * 24 * 60 * 60 * 1000;
  const pollClosesAt = new Date(
    Math.min(requestedClose ? new Date(requestedClose).getTime() : defaultClose, earliestOption)
  ).toISOString();

  const result = await sql`
    INSERT INTO matches
      (group_id, created_by, mode, match_kind, required_players, note, status, season_id,
       poll_closes_at)
    VALUES
      (${params.id}, ${session.userId}, 'poll', ${matchKind}, ${requiredPlayers},
       ${note}, 'poll_open', ${season.id}, ${pollClosesAt})
    RETURNING id, mode, match_kind, status, created_at, poll_closes_at
  `;
  const match = result.rows[0];

  const values: string[] = [];
  const insertParams: unknown[] = [];
  options.forEach((option, index) => {
    const base = index * 3;
    values.push(`($${base + 1}::uuid, $${base + 2}::timestamptz, $${base + 3}::text)`);
    insertParams.push(match.id, option.startsAt, option.location);
  });
  await sql.query(
    `INSERT INTO match_options (match_id, starts_at, location) VALUES ${values.join(", ")}`,
    insertParams
  );

  return NextResponse.json({ match });
}
