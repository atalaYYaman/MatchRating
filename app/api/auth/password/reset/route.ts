import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { consumeToken, verifyToken } from "@/lib/authTokens";
import { hashPassword } from "@/lib/password";

// POST { token, password } — yeni sifreyi yazar.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (password.length < 8) {
    return NextResponse.json({ error: "Şifre en az 8 karakter olmalı." }, { status: 400 });
  }

  const check = await verifyToken(token, "sifirlama");
  if (!check.valid) {
    const msg =
      check.reason === "expired"
        ? "Bağlantının süresi dolmuş. Yeniden şifre sıfırlama isteyin."
        : check.reason === "used"
        ? "Bu bağlantı zaten kullanılmış."
        : "Bağlantı geçersiz.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  await sql`
    UPDATE users SET password_hash = ${await hashPassword(password)}
    WHERE id = ${check.userId}
  `;
  await consumeToken(check.tokenId);
  // Sifre degistiyse e-postaya erisimi kanitlanmis demektir.
  await sql`
    UPDATE users SET email_verified_at = COALESCE(email_verified_at, now())
    WHERE id = ${check.userId}
  `;
  return NextResponse.json({ ok: true });
}
