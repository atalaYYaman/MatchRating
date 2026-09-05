import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sendPasswordResetMail } from "@/lib/authMails";

// POST { email } — sifre sifirlama talebi.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return NextResponse.json({ error: "E-posta girin." }, { status: 400 });

  const res = await sql`SELECT id, name, email FROM users WHERE lower(email) = ${email}`;
  const user = res.rows[0];

  // Hesabin var olup olmadigini SIZDIRMIYORUZ: her durumda ayni cevap.
  // Aksi halde bu uc, kimlerin kayitli oldugunu ogrenmek icin kullanilir.
  if (user) {
    await sendPasswordResetMail(user.id as string, user.email as string, user.name as string);
  }
  return NextResponse.json({ ok: true });
}
