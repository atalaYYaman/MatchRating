import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isGroupMember } from "@/lib/groupAccess";
import { buildSeasonSummary, getSeason } from "@/lib/seasons";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; seasonId: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const isMember = await isGroupMember(params.id, session.userId);
  if (!isMember) return NextResponse.json({ error: "Bu takıma erişiminiz yok." }, { status: 403 });

  const season = await getSeason(params.id, params.seasonId);
  if (!season) return NextResponse.json({ error: "Sezon bulunamadı." }, { status: 404 });

  // Kapali sezon dondurulmus ozetini kullanir; aktif sezon canli hesaplanir.
  const summary =
    season.status === "closed" && season.summary
      ? season.summary
      : await buildSeasonSummary(params.id, params.seasonId);

  return NextResponse.json({ season, summary, live: season.status === "active" });
}
