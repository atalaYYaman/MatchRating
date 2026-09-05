import { sql } from "@/lib/db";

// Uygulama ici bildirimler. E-posta ya da push gerektirmez; kullanici
// uygulamayi actiginda gorur.
//
// Uretim noktasi: olaylarin gerceklestigi rotalar (mac olusturma, anket
// kesinlesme, puanlama penceresi acilmasi). dedupe_key ayni olay icin ayni
// kisiye ikinci bildirimin yazilmasini engeller; boylece "olustur" cagrisi
// tekrar calissa bile kullanici iki kez uyarilmaz.

export type NotificationKind =
  | "mac_olusturuldu"
  | "mac_planlandi"
  | "puanlama_acildi"
  | "mac_iptal";

type Input = {
  userIds: string[];
  groupId: string | null;
  matchId: string | null;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  /** Ayni olay icin sabit bir anahtar; ornegin `puanlama:<macId>`. */
  dedupeKey?: string | null;
};

export async function notify(input: Input): Promise<number> {
  const users = [...new Set(input.userIds)].filter(Boolean);
  if (users.length === 0) return 0;

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
      input.body ?? null,
      input.dedupeKey ? `${input.dedupeKey}` : null
    );
  });

  const res = await sql.query(
    `INSERT INTO notifications
       (user_id, group_id, match_id, kind, title, body, dedupe_key)
     VALUES ${values.join(", ")}
     ON CONFLICT DO NOTHING`,
    params
  );
  return res.rowCount ?? 0;
}

// Bildirim yan etkidir: yazilamamasi asil islemi (mac olusturma, iptal,
// anket kesinlesme) KIRMAMALI. Cagri yerleri bunu kullanir; await edilir
// ki sunucusuz ortamda yanittan sonra kesilmesin, ama asla firlatmaz.
export async function notifySafe(input: Input): Promise<number> {
  try {
    return await notify(input);
  } catch (err) {
    console.error("[bildirim] yazilamadi:", err);
    return 0;
  }
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
