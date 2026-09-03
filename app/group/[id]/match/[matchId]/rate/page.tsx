"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge, Card, ErrorText, Eyebrow, InlineMessage, ScoreBadge } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";
import { SKILLS, SkillKey } from "@/lib/skills";

type Detail = {
  rating: {
    open: boolean;
    played: boolean;
    participants: { id: string; name: string }[];
    // Kendin haric puanlanacak oyuncular (sunucu ayiriyor).
    targets: { id: string; name: string }[];
    myRatings: {
      target_id: string;
      score: number;
      strength_skill: string;
      weakness_skill: string;
    }[];
  };
};

type Draft = { score: number; strength: SkillKey | null; weakness: SkillKey | null };

const NEUTRAL = 7;

export default function RateMatchPage() {
  const params = useParams<{ id: string; matchId: string }>();
  const router = useRouter();
  const { id: groupId, matchId } = params;

  const [participants, setParticipants] = useState<{ id: string; name: string }[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Detail>(`/api/groups/${groupId}/matches/${matchId}`);
      setParticipants(res.rating.targets);
      setDone(new Set(res.rating.myRatings.map((r) => r.target_id)));

      // Daha once puanladiklarim formda gorunsun ki duzeltilebilsin.
      const initial: Record<string, Draft> = {};
      for (const p of res.rating.targets) {
        const mine = res.rating.myRatings.find((r) => r.target_id === p.id);
        initial[p.id] = mine
          ? {
              score: Number(mine.score),
              strength: mine.strength_skill as SkillKey,
              weakness: mine.weakness_skill as SkillKey,
            }
          : { score: NEUTRAL, strength: null, weakness: null };
      }
      setDrafts(initial);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Yüklenemedi.");
    }
  }, [groupId, matchId]);

  useEffect(() => {
    load();
  }, [load]);

  function update(targetId: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [targetId]: { ...prev[targetId], ...patch } }));
  }

  async function submit() {
    const payload = Object.entries(drafts)
      .filter(([, d]) => d.strength && d.weakness)
      .map(([targetId, d]) => ({
        targetId,
        score: d.score,
        strengthSkill: d.strength,
        weaknessSkill: d.weakness,
      }));

    if (payload.length === 0) {
      setError("En az bir oyuncu için güçlü ve zayıf yön seç.");
      return;
    }

    if (
      !confirm(
        `${payload.length} oyuncu için puanın gönderilecek. Puanlar bir kez verilir, sonradan değiştiremezsin. Onaylıyor musun?`
      )
    )
      return;

    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/groups/${groupId}/matches/${matchId}/ratings`, {
        ratings: payload,
      });
      router.push(`/group/${groupId}/match/${matchId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Puanlama kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p>
        <Link href={`/group/${groupId}/match/${matchId}`}>← Maç</Link>
      </p>
      <h1>Maçı Oyla</h1>

      <Card>
        <p className="muted" style={{ margin: 0 }}>
          Her oyuncuya 10 üzerinden puan ver ve maçta öne çıkan bir güçlü, bir zayıf
          yönünü seç. 7 nötr kabul edilir: 7&apos;nin üstü güçlü yönü yükseltir, altı
          zayıf yönü düşürür.
        </p>
      </Card>

      <ErrorText>{error}</ErrorText>

      {participants.map((p) => {
        const d = drafts[p.id];
        if (!d) return null;
        return (
          <Card key={p.id} raised>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="stack grow">
                <h2 style={{ margin: 0 }}>{p.name}</h2>
                {done.has(p.id) && <Badge tone="brand">Puanladın</Badge>}
              </div>
              <ScoreBadge value={d.score.toFixed(1)} label="MAÇ" />
            </div>

            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={d.score}
              onChange={(e) => update(p.id, { score: Number(e.target.value) })}
              style={{ width: "100%", margin: "12px 0" }}
            />

            <Eyebrow>ÖNE ÇIKAN YÖNÜ</Eyebrow>
            <div className="chips" style={{ margin: "8px 0 16px" }}>
              {SKILLS.map((skill) => (
                <button
                  key={skill.key}
                  className={`chip ${d.strength === skill.key ? "chip-strength" : ""}`}
                  disabled={d.weakness === skill.key}
                  onClick={() => update(p.id, { strength: skill.key })}
                >
                  {skill.label}
                </button>
              ))}
            </div>

            <Eyebrow>ZAYIF KALDIĞI YÖN</Eyebrow>
            <div className="chips" style={{ marginTop: 8 }}>
              {SKILLS.map((skill) => (
                <button
                  key={skill.key}
                  className={`chip ${d.weakness === skill.key ? "chip-weakness" : ""}`}
                  disabled={d.strength === skill.key}
                  onClick={() => update(p.id, { weakness: skill.key })}
                >
                  {skill.label}
                </button>
              ))}
            </div>
          </Card>
        );
      })}

      {participants.length === 0 && (
        <Card>
          <p className="muted" style={{ margin: 0 }}>
            Bu maçta puanlanacak oyuncu yok.
          </p>
        </Card>
      )}

      {participants.length > 0 && (
        <>
          <InlineMessage tone="danger">
            Puanlar bir kez verilir; gönderdikten sonra değiştiremezsin.
          </InlineMessage>
          <button className="full" onClick={submit} disabled={saving}>
            Puanlamayı gönder
          </button>
        </>
      )}
    </div>
  );
}
