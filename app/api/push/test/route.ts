import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendPush } from "@/lib/push";

// POST — kullaniciya KENDI cihazlarina test bildirimi gonderir.
//
// Telefon telefon test edebilmek icin var: "bildirim geliyor mu" sorusunu
// gercek bir mac beklemeden yanitliyor. Yalnizca cagiran kisinin kendi
// cihazlarina gidiyor, baskasina bildirim gonderilemiyor.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const tokens = await sql`
    SELECT token, platform FROM push_tokens WHERE user_id = ${session.userId}
  `;
  if (tokens.rowCount === 0) {
    return NextResponse.json(
      {
        ok: false,
        devices: 0,
        error: "Bu hesapta kayıtlı cihaz yok. Bildirim izni verilmemiş olabilir.",
      },
      { status: 409 }
    );
  }

  // sendPush'in kendisi (sendPushSafe degil): burada hatayi GORMEK
  // istiyoruz, test ekraninin isi zaten sorunu gostermek.
  const { sent } = await sendPush({
    userIds: [session.userId],
    title: "Panenka test bildirimi",
    body: "Bu bildirimi gördüysen kurulum çalışıyor.",
    channelId: "maclar",
    data: { kind: "test" },
  });

  return NextResponse.json({
    ok: sent > 0,
    devices: tokens.rowCount,
    sent,
    platforms: tokens.rows.map((r) => r.platform as string | null),
  });
}
