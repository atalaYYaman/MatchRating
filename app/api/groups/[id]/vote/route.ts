import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { SKILL_KEYS } from "@/lib/skills";
import { isValidScore, MIN_SCORE, MAX_SCORE } from "@/lib/scoring";
import { isPositionKey } from "@/lib/positions";

async function assertMember(groupId: string, userId: string) {
  const result = await sql`
    SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId}
  `;
  return result.rows.length > 0;
}

// GET: bu kullanicinin bu grupta kimlere oy verdigini dondurur (hangi hedefler tamamlandi)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const [isMember, votes, positionVotes] = await Promise.all([
    assertMember(params.id, session.userId),
    sql`
      SELECT target_id, skill, score FROM votes
      WHERE group_id = ${params.id} AND voter_id = ${session.userId}
    `,
    sql`
      SELECT target_id, primary_position, secondary_position FROM position_votes
      WHERE group_id = ${params.id} AND voter_id = ${session.userId}
    `,
  ]);
  if (!isMember) return NextResponse.json({ error: "Bu takıma erişiminiz yok." }, { status: 403 });

  return NextResponse.json({
    votes: votes.rows,
    positionVotes: positionVotes.rows,
  });
}

// POST: { targetId, scores, primaryPosition, secondaryPosition }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const isMember = await assertMember(params.id, session.userId);
  if (!isMember) return NextResponse.json({ error: "Bu takıma erişiminiz yok." }, { status: 403 });

  const { targetId, scores, primaryPosition, secondaryPosition } = await req.json();
  if (!targetId || !scores || typeof scores !== "object") {
    return NextResponse.json({ error: "Eksik veri." }, { status: 400 });
  }
  if (targetId === session.userId) {
    return NextResponse.json({ error: "Kendinize oy veremezsiniz." }, { status: 400 });
  }
  if (!isPositionKey(primaryPosition) || !isPositionKey(secondaryPosition)) {
    return NextResponse.json({ error: "Birincil ve ikincil mevki seçmelisiniz." }, { status: 400 });
  }
  if (primaryPosition === secondaryPosition) {
    return NextResponse.json({ error: "Birincil ve ikincil mevki farklı olmalı." }, { status: 400 });
  }

  const targetIsMember = await assertMember(params.id, targetId);
  if (!targetIsMember) {
    return NextResponse.json({ error: "Oy verilen kişi bu takımda değil." }, { status: 400 });
  }

  for (const key of SKILL_KEYS) {
    const raw = scores[key];
    const value = Number(raw);
    if (!isValidScore(value)) {
      return NextResponse.json(
        { error: `Geçersiz puan (${key}). ${MIN_SCORE}-${MAX_SCORE} arası olmalı.` },
        { status: 400 }
      );
    }
  }

  for (const key of SKILL_KEYS) {
    const value = Math.round(Number(scores[key]));
    await sql`
      INSERT INTO votes (group_id, voter_id, target_id, skill, score)
      VALUES (${params.id}, ${session.userId}, ${targetId}, ${key}, ${value})
      ON CONFLICT (group_id, voter_id, target_id, skill)
      DO UPDATE SET score = EXCLUDED.score, created_at = now()
    `;
  }

  await sql`
    INSERT INTO position_votes (group_id, voter_id, target_id, primary_position, secondary_position)
    VALUES (${params.id}, ${session.userId}, ${targetId}, ${primaryPosition}, ${secondaryPosition})
    ON CONFLICT (group_id, voter_id, target_id)
    DO UPDATE SET
      primary_position = EXCLUDED.primary_position,
      secondary_position = EXCLUDED.secondary_position,
      created_at = now()
  `;

  return NextResponse.json({ ok: true });
}
