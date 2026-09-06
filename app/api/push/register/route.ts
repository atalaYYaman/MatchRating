import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

// POST { token, platform } — cihaz push token'ini kaydeder.
// Uygulama her acilista cagirir; last_seen_at guncellenir.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const platform =
    body?.platform === "ios" || body?.platform === "android" ? body.platform : null;

  // Expo token bicimi: ExponentPushToken[...] ya da ExpoPushToken[...]
  if (!token || !/^Expo(nent)?PushToken\[.+\]$/.test(token)) {
    return NextResponse.json({ error: "Geçersiz token." }, { status: 400 });
  }

  // Ayni token baska bir hesapta kayitliysa sahibi guncellenir: cihaz el
  // degistirmis ya da kullanici hesap degistirmis olabilir. Aksi halde
  // bildirimler eski sahibine gitmeye devam ederdi.
  await sql`
    INSERT INTO push_tokens (token, user_id, platform)
    VALUES (${token}, ${session.userId}, ${platform})
    ON CONFLICT (token) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          platform = EXCLUDED.platform,
          last_seen_at = now()
  `;
  return NextResponse.json({ ok: true });
}

// DELETE { token } — cikis yapinca cihazi cozer.
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token : "";
  if (token) {
    await sql`DELETE FROM push_tokens WHERE token = ${token} AND user_id = ${session.userId}`;
  }
  return NextResponse.json({ ok: true });
}
