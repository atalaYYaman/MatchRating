import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendVerificationMail } from "@/lib/authMails";

// POST — giris yapmis kullaniciya yeni dogrulama e-postasi.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const res = await sql`
    SELECT id, name, email, email_verified_at FROM users WHERE id = ${session.userId}
  `;
  const user = res.rows[0];
  if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  if (user.email_verified_at) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const result = await sendVerificationMail(
    user.id as string,
    user.email as string,
    user.name as string
  );
  if (!result.sent && result.reason === "not_configured") {
    return NextResponse.json(
      { error: "E-posta gönderimi henüz yapılandırılmadı." },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: result.sent });
}
