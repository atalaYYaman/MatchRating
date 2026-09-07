import { sql } from "@/lib/db";
import { KIND_LIST, NotificationKind } from "@/lib/notificationKinds";

// Kullanici basina bildirim tercihleri.
//
// Tabloda YALNIZCA acik secim duruyor. Satiri olmayan herkes bildirimi
// alir; yani "varsayilan acik" bir kural degil, veri modelinin kendisi.
// Yeni bir bildirim turu ekledigimizde kimseye kayit yazmamiz gerekmiyor.

/**
 * Verilen turu KAPATMIS kullanicilari listeden cikarir.
 * Bildirim yazilmadan once cagrilir; hem uygulama ici bildirimi hem
 * push'u birlikte susturur -- kullanici kutuyu kaldirdiysa zilde de
 * gormek istemiyordur.
 */
export async function filterByPref(
  userIds: string[],
  kind: NotificationKind
): Promise<string[]> {
  const users = [...new Set(userIds)].filter(Boolean);
  if (users.length === 0) return [];

  const res = await sql.query(
    `SELECT user_id FROM notification_prefs
     WHERE kind = $1 AND enabled = false AND user_id = ANY($2::uuid[])`,
    [kind, users]
  );
  if (res.rowCount === 0) return users;

  const off = new Set(res.rows.map((r) => r.user_id as string));
  return users.filter((id) => !off.has(id));
}

/** Ayar ekrani icin: her tur ve acik mi degil mi. */
export async function getPrefs(
  userId: string
): Promise<Record<NotificationKind, boolean>> {
  const res = await sql`
    SELECT kind, enabled FROM notification_prefs WHERE user_id = ${userId}
  `;
  const saved = new Map(res.rows.map((r) => [r.kind as string, r.enabled as boolean]));

  const out = {} as Record<NotificationKind, boolean>;
  for (const kind of KIND_LIST) {
    out[kind] = saved.get(kind) ?? true;
  }
  return out;
}

/** Tek bir turu acar/kapatir. */
export async function setPref(
  userId: string,
  kind: NotificationKind,
  enabled: boolean
): Promise<void> {
  await sql`
    INSERT INTO notification_prefs (user_id, kind, enabled)
    VALUES (${userId}, ${kind}, ${enabled})
    ON CONFLICT (user_id, kind)
      DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()
  `;
}
