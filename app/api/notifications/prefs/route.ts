import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { NOTIFICATION_KINDS, isNotificationKind } from "@/lib/notificationKinds";
import { getPrefs, setPref } from "@/lib/notifyPrefs";

// GET — ayar ekraninin listesi: her tur, etiketi ve acik mi degil mi.
//
// Turleri sunucudan gonderiyoruz ki yeni bir bildirim turu ekledigimizde
// mobil uygulamayi guncellemek gerekmesin; ekran gelen listeyi ciziyor.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const prefs = await getPrefs(session.userId);
  return NextResponse.json({
    prefs: NOTIFICATION_KINDS.map((k) => ({
      kind: k.kind,
      label: k.label,
      description: k.description,
      enabled: prefs[k.kind],
    })),
  });
}

// PATCH { kind, enabled } — tek bir turu acar/kapatir.
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const kind = body?.kind;
  const enabled = body?.enabled;

  if (!isNotificationKind(kind) || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  await setPref(session.userId, kind, enabled);
  return NextResponse.json({ ok: true, kind, enabled });
}
