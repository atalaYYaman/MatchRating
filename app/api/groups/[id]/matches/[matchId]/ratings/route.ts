import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isGroupMember } from "@/lib/groupAccess";
import { SKILL_KEYS, SkillKey } from "@/lib/skills";
import { isValidMatchScore, maybeProcessMatchRatings } from "@/lib/matchRating";

const SKILL_SET = new Set<string>(SKILL_KEYS);

function isSkillKey(value: unknown): value is SkillKey {
  return typeof value === "string" && SKILL_SET.has(value);
}

type RatingInput = {
  targetId: string;
  score: number;
  strengthSkill: SkillKey;
  weaknessSkill: SkillKey;
};

// POST: { ratings: [{ targetId, score, strengthSkill, weaknessSkill }] }
// Tek seferde birden fazla oyuncu puanlanabilir. Bir oyuncu yalnizca bir kez
// puanlanir; tekrar denenirse 409 doner.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; matchId: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const [isMember, matchRes, attendanceRes] = await Promise.all([
    isGroupMember(params.id, session.userId),
    sql`
      SELECT id, status, scheduled_at, ratings_processed_at FROM matches
      WHERE id = ${params.matchId} AND group_id = ${params.id}
    `,
    sql`
      SELECT user_id FROM match_attendance
      WHERE match_id = ${params.matchId} AND status = 'yes'
    `,
  ]);

  if (!isMember) {
    return NextResponse.json({ error: "Bu takıma erişiminiz yok." }, { status: 403 });
  }
  const match = matchRes.rows[0];
  if (!match) return NextResponse.json({ error: "Maç bulunamadı." }, { status: 404 });
  if (match.ratings_processed_at) {
    return NextResponse.json(
      { error: "Bu maçın puanlaması kapandı." },
      { status: 400 }
    );
  }
  if (match.status !== "scheduled") {
    return NextResponse.json({ error: "Bu maç puanlanamaz." }, { status: 400 });
  }
  if (
    !match.scheduled_at ||
    new Date(match.scheduled_at as string).getTime() > Date.now()
  ) {
    return NextResponse.json(
      { error: "Maç henüz oynanmadı." },
      { status: 400 }
    );
  }

  const participants = new Set(attendanceRes.rows.map((r) => r.user_id as string));
  if (!participants.has(session.userId)) {
    return NextResponse.json(
      { error: "Sadece maça katılan oyuncular puanlama yapabilir." },
      { status: 403 }
    );
  }

  // Mac sonu puani bir kez verilir; digerlerinin oyunu gorup fikir
  // degistirmeyi engeller.
  const existing = await sql`
    SELECT target_id FROM match_ratings
    WHERE match_id = ${params.matchId} AND rater_id = ${session.userId}
  `;
  const alreadyRated = new Set(existing.rows.map((r) => r.target_id as string));

  const body = await req.json().catch(() => ({}));
  if (!Array.isArray(body?.ratings) || body.ratings.length === 0) {
    return NextResponse.json({ error: "Puanlama verisi eksik." }, { status: 400 });
  }

  const parsed: RatingInput[] = [];
  const seen = new Set<string>();
  for (const item of body.ratings) {
    if (!item || typeof item !== "object") {
      return NextResponse.json({ error: "Geçersiz puanlama verisi." }, { status: 400 });
    }
    const row = item as Record<string, unknown>;
    const targetId = typeof row.targetId === "string" ? row.targetId : "";
    const score = Number(row.score);

    if (!participants.has(targetId)) {
      return NextResponse.json(
        { error: "Puanlanan oyuncu bu maça katılmamış." },
        { status: 400 }
      );
    }
    if (targetId === session.userId) {
      return NextResponse.json({ error: "Kendinizi puanlayamazsınız." }, { status: 400 });
    }
    if (seen.has(targetId)) {
      return NextResponse.json(
        { error: "Aynı oyuncu birden fazla kez gönderildi." },
        { status: 400 }
      );
    }
    if (alreadyRated.has(targetId)) {
      return NextResponse.json(
        { error: "Bu oyuncuyu zaten puanladın. Puanlar bir kez verilir." },
        { status: 409 }
      );
    }
    if (!isValidMatchScore(score)) {
      return NextResponse.json(
        { error: "Puan 0-10 arasında olmalı." },
        { status: 400 }
      );
    }
    if (!isSkillKey(row.strengthSkill) || !isSkillKey(row.weaknessSkill)) {
      return NextResponse.json(
        { error: "Güçlü ve zayıf yön seçmelisiniz." },
        { status: 400 }
      );
    }
    if (row.strengthSkill === row.weaknessSkill) {
      return NextResponse.json(
        { error: "Güçlü ve zayıf yön farklı olmalı." },
        { status: 400 }
      );
    }

    seen.add(targetId);
    parsed.push({
      targetId,
      score: Math.round(score * 10) / 10,
      strengthSkill: row.strengthSkill,
      weaknessSkill: row.weaknessSkill,
    });
  }

  const values: string[] = [];
  const insertParams: unknown[] = [];
  parsed.forEach((rating, index) => {
    const base = index * 6;
    values.push(
      `($${base + 1}::uuid, $${base + 2}::uuid, $${base + 3}::uuid,` +
        ` $${base + 4}::numeric, $${base + 5}::text, $${base + 6}::text)`
    );
    insertParams.push(
      params.matchId,
      session.userId,
      rating.targetId,
      rating.score,
      rating.strengthSkill,
      rating.weaknessSkill
    );
  });

  await sql.query(
    `INSERT INTO match_ratings
       (match_id, rater_id, target_id, score, strength_skill, weakness_skill)
     VALUES ${values.join(", ")}
     ON CONFLICT (match_id, rater_id, target_id) DO NOTHING`,
    insertParams
  );

  // Herkes tamamladiysa puanlar burada islenir.
  const result = await maybeProcessMatchRatings(params.matchId);

  return NextResponse.json({ ok: true, processed: result.processed });
}
