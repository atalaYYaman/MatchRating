import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/admin";
import { computeAdminStats } from "@/lib/adminStats";

export async function GET() {
  const session = await getSession();
  if (!isPlatformAdmin(session)) {
    // Yonetici olmayana panelin varligini bile belli etmiyoruz.
    return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  }
  const stats = await computeAdminStats();
  return NextResponse.json({ stats });
}
