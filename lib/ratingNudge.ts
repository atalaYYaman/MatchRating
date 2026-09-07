import { sql } from "@/lib/db";
import { matchEndsAt, ratingDeadline } from "@/lib/matchStatus";
import { notifySafe } from "@/lib/notifications";
import { groupName, heading, timeLabel } from "@/lib/notifyText";

// "Puanlama acildi" bildirimi.
//
// Puanlama asamasi veritabaninda saklanmiyor, saatten TURETILIYOR
// (lib/matchStatus.ts). Yani haber verecek bir olay yok: mac bitis saatini
// gecince kimse bir sey yazmiyor. Bu yuzden bildirim, diger tembel islerle
// (maybeProcessMatchRatings, maybeAutoClosePoll) ayni yerde, mac okundugunda
// uretiliyor. Uygulamayi ilk acan kisi digerleri icin de tetiklemis oluyor;
// mimarinin geri kalaniyla ayni yaklasim, ayri bir cron gerektirmiyor.
//
// Tekrari dedupe_key engelliyor: her kullaniciya mac basina bir kez.

export async function maybeNotifyRatingOpen(matchId: string): Promise<number> {
  const res = await sql`
    SELECT id, group_id, status, scheduled_at, ratings_processed_at
    FROM matches WHERE id = ${matchId}
  `;
  const match = res.rows[0];
  if (!match) return 0;
  if (match.status !== "scheduled") return 0;
  if (match.ratings_processed_at) return 0;
  if (!match.scheduled_at) return 0;

  const now = Date.now();
  const scheduledAt = match.scheduled_at as string;
  // Mac daha bitmediyse erken; sure tamamen dolduysa gec -- kimseyi
  // artik puanlayamayacagi bir sey icin uyandirmayalim.
  if (now < matchEndsAt(scheduledAt).getTime()) return 0;
  if (now >= ratingDeadline(scheduledAt).getTime()) return 0;

  // Yalnizca maca gelenler puanliyor; gelmeyeni rahatsiz etmiyoruz.
  const attendance = await sql`
    SELECT user_id FROM match_attendance
    WHERE match_id = ${matchId} AND status = 'yes'
  `;
  const userIds = attendance.rows.map((r) => r.user_id as string).filter(Boolean);
  if (userIds.length < 2) return 0;

  return notifySafe({
    userIds,
    groupId: match.group_id as string,
    matchId,
    kind: "puanlama_acildi",
    title: heading("Puanlama açık", await groupName(match.group_id as string)),
    // Sureyi ve sonucu yaziyoruz: puanlamayan oyuncu puan cezasi
    // aliyor (bkz. NO_RATING_PENALTY). Bunu soylemeden gonderilen
    // hatirlatma, cezayi surpriz haline getiriyordu.
    body: `${timeLabel(scheduledAt)} maçındaki arkadaşlarını puanla · puanlamazsan puan kaybedersin`,
    dedupeKey: `puanlama_acildi:${matchId}`,
  });
}
