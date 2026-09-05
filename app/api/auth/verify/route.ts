import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { consumeToken, verifyToken } from "@/lib/authTokens";

// POST { token } — dogrulama linkinin hedefi.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token : "";
  if (!token) return NextResponse.json({ error: "Geçersiz bağlantı." }, { status: 400 });

  const check = await verifyToken(token, "dogrulama");
  if (!check.valid) {
    const msg =
      check.reason === "expired"
        ? "Bağlantının süresi dolmuş. Yeni bir doğrulama e-postası iste."
        : check.reason === "used"
        ? "Bu bağlantı zaten kullanılmış. Hesabın muhtemelen doğrulanmış durumda."
        : "Bağlantı geçersiz.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  await sql`UPDATE users SET email_verified_at = now() WHERE id = ${check.userId}`;
  await consumeToken(check.tokenId);
  return NextResponse.json({ ok: true });
}
