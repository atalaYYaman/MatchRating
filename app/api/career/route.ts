import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isGroupMember } from "@/lib/groupAccess";
import { computeCareer } from "@/lib/career";

// GET /api/career?groupId=...  (groupId yoksa kullanicinin tum takimlari)
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const groupId = req.nextUrl.searchParams.get("groupId");
  if (groupId) {
    const isMember = await isGroupMember(groupId, session.userId);
    if (!isMember) {
      return NextResponse.json({ error: "Bu takıma erişiminiz yok." }, { status: 403 });
    }
  }

  const career = await computeCareer(session.userId, groupId);
  return NextResponse.json({ career });
}
