import { sql } from "@/lib/db";

// Expo Push API uzerinden bildirim gonderimi.
//
// Uygulama ici bildirim (notifications tablosu) her zaman yazilir; push
// onun ustune bir HABER VERME katmani. Push basarisiz olursa kullanici
// bildirimi uygulamayi actiginda yine gorur, o yuzden buradaki hicbir
// hata cagiran akisi kirmamali.

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
// Expo tek istekte en fazla 100 mesaj kabul ediyor.
const BATCH = 100;

type PushMessage = {
  to: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  sound: "default";
  /** Android: bildirimin hangi kanaldan gosterilecegi. */
  channelId?: string;
  /**
   * Android'in Doze modunda "normal" oncelikli bildirimler ekran
   * acilana kadar bekletilebiliyor. Bizim bildirimlerimizin hepsi
   * zamana bagli (mac saati, puanlama suresi), bekletilmeleri
   * ise yaramaz hale getiriyor.
   */
  priority: "high";
};

/** Kullanicilarin kayitli cihaz token'lari. */
async function tokensFor(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const res = await sql.query(
    `SELECT token FROM push_tokens WHERE user_id = ANY($1::uuid[])`,
    [userIds]
  );
  return res.rows.map((r) => r.token as string);
}

/**
 * Artik gecerli olmayan token'lari siler. Uygulama kaldirilinca ya da
 * cihaz degisince Expo "DeviceNotRegistered" doner; temizlemezsek her
 * bildirimde bos yere denemeye devam ederiz.
 */
async function dropTokens(tokens: string[]) {
  if (tokens.length === 0) return;
  await sql.query(`DELETE FROM push_tokens WHERE token = ANY($1::text[])`, [tokens]);
}

export async function sendPush(input: {
  userIds: string[];
  title: string;
  body?: string | null;
  data?: Record<string, unknown>;
  channelId?: string;
}): Promise<{ sent: number }> {
  const tokens = await tokensFor([...new Set(input.userIds)]);
  if (tokens.length === 0) return { sent: 0 };

  const messages: PushMessage[] = tokens.map((to) => ({
    to,
    title: input.title,
    body: input.body ?? undefined,
    data: input.data,
    sound: "default",
    channelId: input.channelId,
    priority: "high",
  }));

  let sent = 0;
  const dead: string[] = [];

  for (let i = 0; i < messages.length; i += BATCH) {
    const chunk = messages.slice(i, i + BATCH);
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        // Expo hesabinda "Enhanced Security" acilirsa bu sart olur.
        ...(process.env.EXPO_ACCESS_TOKEN
          ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(chunk),
    });

    if (!res.ok) continue;
    const json = (await res.json()) as {
      data?: { status: string; details?: { error?: string } }[];
    };

    (json.data ?? []).forEach((ticket, idx) => {
      if (ticket.status === "ok") {
        sent += 1;
      } else if (ticket.details?.error === "DeviceNotRegistered") {
        dead.push(chunk[idx].to);
      }
    });
  }

  await dropTokens(dead);
  return { sent };
}

/**
 * Push yan etkidir: gonderilememesi asil islemi kirmamali. notifySafe ile
 * ayni mantik. AWAIT edilir (sunucusuzda yanittan sonra kesilmesin) ama
 * asla firlatmaz.
 */
export async function sendPushSafe(input: {
  userIds: string[];
  title: string;
  body?: string | null;
  data?: Record<string, unknown>;
  channelId?: string;
}): Promise<number> {
  try {
    const { sent } = await sendPush(input);
    return sent;
  } catch (err) {
    console.error("[push] gonderilemedi:", err);
    return 0;
  }
}
