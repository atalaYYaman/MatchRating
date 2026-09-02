import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildHomeData } from "@/lib/homeData";

// Takima ozel ana sayfa verisi. Yayindaki mobil surumler bu adresi
// kullaniyor; yeni istemciler /api/home?groupId=... uzerinden geciyor.
// Ikisi de lib/homeData.ts'teki ayni toplamayi cagirir.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const data = await buildHomeData({ userId: session.userId, groupId: params.id });
  if (!data) {
    return NextResponse.json({ error: "Bu takıma erişiminiz yok." }, { status: 403 });
  }

  return NextResponse.json(data);
}
