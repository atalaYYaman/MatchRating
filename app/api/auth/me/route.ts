import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  const res = await sql`SELECT email_verified_at FROM users WHERE id = ${session.userId}`;

  return NextResponse.json({
    user: { id: session.userId, name: session.name, email: session.email },
    emailVerified: Boolean(res.rows[0]?.email_verified_at),
    // Yonetim panelinin linkini yalnizca yoneticiye gostermek icin.
    // Yetkinin kendisi yine sunucuda dogrulaniyor; bu sadece gorunurluk.
    isAdmin: isPlatformAdmin(session),
  });
}
