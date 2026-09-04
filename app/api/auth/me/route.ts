import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/admin";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  return NextResponse.json({
    user: { id: session.userId, name: session.name, email: session.email },
    // Yonetim panelinin linkini yalnizca yoneticiye gostermek icin.
    // Yetkinin kendisi yine sunucuda dogrulaniyor; bu sadece gorunurluk.
    isAdmin: isPlatformAdmin(session),
  });
}
