import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

const KINDS = ["sorun", "oneri", "diger"] as const;
const MAX_LENGTH = 2000;

// POST: giris yapmis her kullanici geri bildirim gonderebilir.
// { kind, message, groupId?, app? }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const kind = KINDS.includes(body?.kind) ? body.kind : null;
  const message =
    typeof body?.message === "string" ? body.message.trim().slice(0, MAX_LENGTH) : "";
  const app = body?.app === "mobil" ? "mobil" : "web";
  const groupId = typeof body?.groupId === "string" ? body.groupId : null;

  if (!kind) {
    return NextResponse.json({ error: "Geri bildirim türü seçmelisin." }, { status: 400 });
  }
  if (message.length < 5) {
    return NextResponse.json(
      { error: "Biraz daha ayrıntı yazar mısın? (en az 5 karakter)" },
      { status: 400 }
    );
  }

  // Kullanicinin adi/e-postasi kopyalanarak saklanir: hesap silinse bile
  // geri bildirimin kimden geldigi kaybolmasin.
  const userRes = await sql`SELECT name, email FROM users WHERE id = ${session.userId}`;
  const user = userRes.rows[0];

  // Gonderilen takim gercekten kullanicinin uyesi mi?
  let validGroupId: string | null = null;
  if (groupId) {
    const g = await sql`
      SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${session.userId}
    `;
    if (g.rows.length > 0) validGroupId = groupId;
  }

  await sql`
    INSERT INTO feedback (user_id, user_email, user_name, group_id, kind, message, app)
    VALUES (${session.userId}, ${user?.email ?? null}, ${user?.name ?? null},
            ${validGroupId}, ${kind}, ${message}, ${app})
  `;

  return NextResponse.json({ ok: true });
}
