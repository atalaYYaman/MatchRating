import { sql } from "@/lib/db";
import { CHANNEL_BY_KIND, NotificationKind } from "@/lib/notificationKinds";
import { filterByPref } from "@/lib/notifyPrefs";
import { sendPushSafe } from "@/lib/push";

// Uygulama ici bildirimler + push.
//
// Uretim noktasi: olaylarin gerceklestigi rotalar (mac olusturma, anket
// kesinlesme, puanlama penceresi acilmasi). dedupe_key ayni olay icin ayni
// kisiye ikinci bildirimin yazilmasini engeller; boylece "olustur" cagrisi
// tekrar calissa bile kullanici iki kez uyarilmaz.
//
// Turlerin listesi lib/notificationKinds.ts'te; ayar ekrani da oradan
// uretiliyor.

export type { NotificationKind };

type Input = {
  userIds: string[];
  groupId: string | null;
  matchId: string | null;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  /**
   * Kullaniciya ozel govde. Verilmeyen kullanicilar `body` alir.
   * Ornek: puanlar islendiginde herkese kendi puan degisimini yazmak.
   */
  bodyByUser?: Record<string, string>;
  /** Ayni olay icin sabit bir anahtar; ornegin `puanlama:<macId>`. */
  dedupeKey?: string | null;
};

/**
 * Bildirimleri yazar ve GERCEKTEN yazilan kullanicilari dondurur.
 *
 * Sayi degil liste donmesi onemli: push yalnizca satir yazilan kisiye
 * gitmeli. Onceden push `input.userIds`'e gidiyordu, yani dedupe bir
 * kismini elese bile herkes ikinci kez uyariliyordu.
 */
export async function notify(input: Input): Promise<string[]> {
  // Kapatmis olanlari en basta cikariyoruz: ne zil, ne push.
  const users = await filterByPref(input.userIds, input.kind);
  if (users.length === 0) return [];

  // Tek sorguda toplu insert; kullanici basina ayri istek uzak veritabaninda
  // pahali kaliyor (skill_adjustments'taki yaklasimin aynisi).
  const values: string[] = [];
  const params: unknown[] = [];
  users.forEach((userId, i) => {
    const b = i * 7;
    values.push(
      `($${b + 1}::uuid, $${b + 2}::uuid, $${b + 3}::uuid, $${b + 4}::text,` +
        ` $${b + 5}::text, $${b + 6}::text, $${b + 7}::text)`
    );
    params.push(
      userId,
      input.groupId,
      input.matchId,
      input.kind,
      input.title,
      input.bodyByUser?.[userId] ?? input.body ?? null,
      input.dedupeKey ? `${input.dedupeKey}` : null
    );
  });

  const res = await sql.query(
    `INSERT INTO notifications
       (user_id, group_id, match_id, kind, title, body, dedupe_key)
     VALUES ${values.join(", ")}
     ON CONFLICT DO NOTHING
     RETURNING user_id`,
    params
  );
  return res.rows.map((r) => r.user_id as string);
}

// Bildirim yan etkidir: yazilamamasi asil islemi (mac olusturma, iptal,
// anket kesinlesme) KIRMAMALI. Cagri yerleri bunu kullanir; await edilir
// ki sunucusuz ortamda yanittan sonra kesilmesin, ama asla firlatmaz.
export async function notifySafe(input: Input): Promise<number> {
  let written: string[] = [];
  try {
    written = await notify(input);
  } catch (err) {
    console.error("[bildirim] yazilamadi:", err);
  }

  // Push, uygulama ici bildirimin ustune bir haber verme katmani.
  // Yalnizca YENI satir yazilan kisilere gidiyor: dedupe eledigi ya da
  // tercihinde kapattigi kisiye push atmak dogru olmazdi.
  if (written.length > 0) {
    await sendPushSafe({
      userIds: written,
      title: input.title,
      body: input.body,
      bodyByUser: input.bodyByUser,
      channelId: CHANNEL_BY_KIND[input.kind],
      data: {
        kind: input.kind,
        groupId: input.groupId,
        matchId: input.matchId,
      },
    });
  }
  return written.length;
}

/** Bir gruptaki tum uyeler (istege bagli olarak birini haric tutar). */
export async function groupMemberIds(
  groupId: string,
  exceptUserId?: string
): Promise<string[]> {
  const res = await sql`
    SELECT user_id FROM group_members
    WHERE group_id = ${groupId} AND user_id <> COALESCE(${exceptUserId ?? null}, '00000000-0000-0000-0000-000000000000'::uuid)
  `;
  return res.rows.map((r) => r.user_id as string);
}
