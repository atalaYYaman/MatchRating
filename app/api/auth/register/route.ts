import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "İsim, e-posta ve şifre zorunlu." },
        { status: 400 }
      );
    }
    if (String(password).length < 6) {
      return NextResponse.json(
        { error: "Şifre en az 6 karakter olmalı." },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await sql`SELECT id FROM users WHERE email = ${normalizedEmail}`;
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "Bu e-posta ile zaten bir hesap var." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const result = await sql`
      INSERT INTO users (name, email, password_hash)
      VALUES (${String(name).trim()}, ${normalizedEmail}, ${passwordHash})
      RETURNING id, name, email
    `;
    const user = result.rows[0];

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });
    await setSessionCookie(token);

    return NextResponse.json({ user });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Kayıt sırasında hata oluştu." }, { status: 500 });
  }
}
