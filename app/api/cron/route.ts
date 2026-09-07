import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { sql } from "@/lib/db";
import { sweepCancelledMatches } from "@/lib/cancelledSweep";
import { maybeAutoClosePoll } from "@/lib/pollClose";
import { maybeProcessMatchRatings } from "@/lib/matchRating";
import { maybeNotifyRatingOpen } from "@/lib/ratingNudge";
import { maybeNotifyUpcoming } from "@/lib/matchReminders";

// Zamanlanmis isler.
//
// Sistemin geri kalani bu isleri TEMBEL yapiyor: biri uygulamayi
// actiginda calisiyorlar. Bu, hatirlatmalar icin yetersiz -- kimse
// uygulamayi acmazsa "maca 3 saat kaldi" bildirimi de gitmiyor. Burasi o
// bosluk icin.
//
// Tembel tetikleyiciler KALDI, kaldirmadik: ikisi de ayni fonksiyonlari
// cagiriyor, hepsi idempotent ve dedupe korumali. Tembel yol aninda
// tepki veriyor, cron guvence sagliyor.
//
// Cagiran: GitHub Actions (.github/workflows/cron.yml). Vercel Hobby
// gunde bir cron'a izin veriyor, bu ise 15 dakikada bir gerekiyor.

// Tek calismada islenecek ust sinir: bir istegin sonsuza kadar surmesini
// engelliyor. Artan is bir sonraki calismaya kaliyor.
const MAX_PER_RUN = 50;

export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Sir tanimli degilse uc KAPALI. Yanlislikla herkese acik bir
  // tetikleyici birakmaktansa hic calismasin.
  if (!secret) return false;

  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  // Uzunluk farkliysa timingSafeEqual firlatiyor; once onu esitliyoruz.
  return a.length === b.length && timingSafeEqual(a, b);
}

async function ids(query: ReturnType<typeof sql>): Promise<string[]> {
  const res = await query;
  return res.rows.map((r) => r.id as string);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const started = Date.now();

  // 1) Suresi dolmus anketleri kapat.
  const openPolls = await ids(sql`
    SELECT id FROM matches
    WHERE status = 'poll_open' AND poll_closes_at IS NOT NULL
      AND poll_closes_at <= now()
    ORDER BY poll_closes_at LIMIT ${MAX_PER_RUN}
  `);
  for (const id of openPolls) await maybeAutoClosePoll(id);

  // 2) Oynanmis maclari isle; islenmiyorsa puanlama bildirimi gonder.
  const played = await ids(sql`
    SELECT id FROM matches
    WHERE status = 'scheduled' AND scheduled_at <= now()
    ORDER BY scheduled_at LIMIT ${MAX_PER_RUN}
  `);
  let processed = 0;
  for (const id of played) {
    const r = await maybeProcessMatchRatings(id);
    if (r.processed) processed += 1;
    else await maybeNotifyRatingOpen(id);
  }

  // 3) Yaklasan maclar: yoklama hatirlatmasi ve mac saati bildirimi.
  //    Cron'un asil kazandirdigi is bu -- tembel yolda kimse uygulamayi
  //    acmazsa bu bildirimler hic gitmiyordu.
  const upcoming = await ids(sql`
    SELECT id FROM matches
    WHERE status = 'scheduled' AND scheduled_at > now()
      AND scheduled_at <= now() + interval '24 hours'
    ORDER BY scheduled_at LIMIT ${MAX_PER_RUN}
  `);
  for (const id of upcoming) await maybeNotifyUpcoming(id);

  // 4) Iptal edilmis maclari sil (1 saat sonra).
  const swept = await sweepCancelledMatches();

  return NextResponse.json({
    ok: true,
    ms: Date.now() - started,
    polls: openPolls.length,
    played: played.length,
    processed,
    upcoming: upcoming.length,
    swept,
  });
}
