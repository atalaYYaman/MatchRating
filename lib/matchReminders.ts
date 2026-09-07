import { sql } from "@/lib/db";
import { groupMemberIds, notifySafe } from "@/lib/notifications";
import { groupName, heading, whenLabel, withPlace } from "@/lib/notifyText";

// Mac oncesi hatirlatmalar.
//
// Iki ayri bildirim, cunku iki ayri kitleye iki ayri sey soyluyorlar:
//
//   yoklama_hatirlatma -> HENUZ CEVAP VERMEYENLERE, "gelecek misin?"
//   mac_yaklasiyor     -> GELECEGINI SOYLEYENLERE, "bugun saat kacta, nerede"
//
// Ayni kisi ikisini birden almiyor: cevap verdiyse yoklama hatirlatmasi
// gitmiyor, vermediyse yaklasma bildirimi gitmiyor.
//
// Tetikleme, sistemin geri kalaniyla ayni: mac okundugunda. Ayri bir
// zamanlanmis is yok. Bunun bilinen siniri su -- kimse uygulamayi
// acmazsa hatirlatma da gitmiyor. Pratikte takimda birinin uygulamayi
// acmasi yetiyor, cunku bildirim ONUN icin degil, hatirlatilmasi
// gerekenler icin uretiliyor.

/** Yoklama hatirlatmasi bu kadar saat kala gonderilir. */
const RSVP_WINDOW_HOURS = 24;
/** "Mac yaklasiyor" bu kadar saat kala gonderilir. */
const KICKOFF_WINDOW_HOURS = 6;

export async function maybeNotifyUpcoming(matchId: string): Promise<void> {
  const res = await sql`
    SELECT id, group_id, status, scheduled_at, location
    FROM matches WHERE id = ${matchId}
  `;
  const match = res.rows[0];
  if (!match) return;
  if (match.status !== "scheduled" || !match.scheduled_at) return;

  const kickoff = new Date(match.scheduled_at as string).getTime();
  const hoursLeft = (kickoff - Date.now()) / 3_600_000;
  // Mac basladiysa hatirlatmanin anlami yok.
  if (hoursLeft <= 0) return;

  const groupId = match.group_id as string;
  const name = await groupName(groupId);

  if (hoursLeft <= RSVP_WINDOW_HOURS) {
    await notifyPendingRsvp(matchId, groupId, name, match, hoursLeft);
  }
  if (hoursLeft <= KICKOFF_WINDOW_HOURS) {
    await notifyAttendees(matchId, groupId, name, match);
  }
}

/** Yoklamaya hic cevap vermemis uyeler. */
async function notifyPendingRsvp(
  matchId: string,
  groupId: string,
  name: string | null,
  match: Record<string, unknown>,
  hoursLeft: number
) {
  const members = await groupMemberIds(groupId);
  if (members.length === 0) return;

  const answered = await sql`
    SELECT user_id FROM match_attendance WHERE match_id = ${matchId}
  `;
  const done = new Set(answered.rows.map((r) => r.user_id as string));
  const pending = members.filter((id) => !done.has(id));
  if (pending.length === 0) return;

  // "Yarin" ile "birkac saat kaldi" cok farkli aciliyetler; saati yuvarlayip
  // oldugu gibi yaziyoruz, kullanici kendi kararini versin.
  const left = hoursLeft >= 1 ? `${Math.round(hoursLeft)} saat kaldı` : "birazdan";

  await notifySafe({
    userIds: pending,
    groupId,
    matchId,
    kind: "yoklama_hatirlatma",
    title: heading("Geliyor musun?", name),
    body: `${withPlace(whenLabel(match.scheduled_at as string), match.location as string)} · ${left}`,
    dedupeKey: `yoklama_hatirlatma:${matchId}`,
  });
}

/** "Gelirim" diyenlere mac saati hatirlatmasi. */
async function notifyAttendees(
  matchId: string,
  groupId: string,
  name: string | null,
  match: Record<string, unknown>
) {
  const going = await sql`
    SELECT user_id FROM match_attendance
    WHERE match_id = ${matchId} AND status = 'yes'
  `;
  const userIds = going.rows.map((r) => r.user_id as string);
  if (userIds.length === 0) return;

  await notifySafe({
    userIds,
    groupId,
    matchId,
    kind: "mac_yaklasiyor",
    title: heading("Maç yaklaşıyor", name),
    body: withPlace(
      whenLabel(match.scheduled_at as string),
      match.location as string
    ),
    dedupeKey: `mac_yaklasiyor:${matchId}`,
  });
}
