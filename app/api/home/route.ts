import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildHomeData } from "@/lib/homeData";

// GET /api/home            -> tum takimlar ("Tüm takımlar" filtresi)
// GET /api/home?groupId=X  -> yalnizca o takim
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const groupId = req.nextUrl.searchParams.get("groupId");
  const data = await buildHomeData({ userId: session.userId, groupId });

  if (!data) {
    // Kapsamda takim yok: hic takimi olmayan kullanici ya da uye olmadigi
    // bir takim istendi.
    return NextResponse.json({
      scope: groupId ? "group" : "all",
      group: null,
      groupCount: 0,
      isOwner: false,
      nextMatch: null,
      monthStats: {
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        streak: 0,
        recentResults: [],
      },
      lastMatch: null,
    });
  }

  return NextResponse.json(data);
}
