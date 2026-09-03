"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge, Card, ErrorText, Eyebrow, InlineMessage } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";
import { SKILLS, SkillKey } from "@/lib/skills";
import { DEFAULT_SCORE, MAX_SCORE, MIN_SCORE } from "@/lib/scoring";
import { POSITIONS, PositionKey, isPositionKey } from "@/lib/positions";

const DEFAULT_SCORES: Record<SkillKey, number> = {
  sut: DEFAULT_SCORE,
  pas: DEFAULT_SCORE,
  dribling: DEFAULT_SCORE,
  hiz: DEFAULT_SCORE,
  fizik: DEFAULT_SCORE,
  defans: DEFAULT_SCORE,
};

type Member = { id: string; name: string; email: string };
type ExistingVote = { target_id: string; skill: string; score: number };
type ExistingPositionVote = {
  target_id: string;
  primary_position: string;
  secondary_position: string;
};

export default function VotePage() {
  const params = useParams<{ id: string }>();
  const groupId = params.id;

  const [members, setMembers] = useState<Member[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [skillVotes, setSkillVotes] = useState<ExistingVote[]>([]);
  const [positionVotes, setPositionVotes] = useState<ExistingPositionVote[]>([]);
  const [activeTarget, setActiveTarget] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<SkillKey, number>>({ ...DEFAULT_SCORES });
  const [primary, setPrimary] = useState<PositionKey | null>(null);
  const [secondary, setSecondary] = useState<PositionKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [me, groupData, votesData] = await Promise.all([
        api.get<{ user: { id: string } | null }>("/api/auth/me"),
        api.get<{ members: Member[] }>(`/api/groups/${groupId}`),
        api.get<{ votes: ExistingVote[]; positionVotes: ExistingPositionVote[] }>(
          `/api/groups/${groupId}/vote`
        ),
      ]);
      setMeId(me.user?.id ?? null);
      setMembers(groupData.members);
      setSkillVotes(votesData.votes ?? []);
      setPositionVotes(votesData.positionVotes ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Takım yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const teammates = useMemo(
    () => members.filter((m) => m.id !== meId),
    [members, meId]
  );

  // Bir oyuncu, 6 yetenegin tamami ve mevki oyu girildiyse "oylandi" sayilir.
  const votedTargets = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of skillVotes) {
      counts.set(v.target_id, (counts.get(v.target_id) ?? 0) + 1);
    }
    const withPosition = new Set(positionVotes.map((v) => v.target_id));
    const done = new Set<string>();
    for (const [targetId, count] of counts) {
      if (count >= SKILLS.length && withPosition.has(targetId)) done.add(targetId);
    }
    return done;
  }, [skillVotes, positionVotes]);

  function openVoteFor(targetId: string) {
    const next = { ...DEFAULT_SCORES };
    for (const v of skillVotes) {
      if (v.target_id === targetId && v.skill in next) {
        next[v.skill as SkillKey] = v.score;
      }
    }
    setScores(next);

    const existing = positionVotes.find((v) => v.target_id === targetId);
    setPrimary(isPositionKey(existing?.primary_position) ? existing.primary_position : null);
    setSecondary(
      isPositionKey(existing?.secondary_position) ? existing.secondary_position : null
    );

    setActiveTarget(targetId);
    setMessage(null);
    setError(null);
  }

  // Mobildeki ile ayni davranis: ilk dokunus birincil, ikincisi ikincil mevki;
  // secili olana tekrar dokunmak geri alir.
  function selectPosition(key: PositionKey) {
    if (primary === key) {
      setPrimary(secondary);
      setSecondary(null);
      return;
    }
    if (secondary === key) {
      setSecondary(null);
      return;
    }
    if (!primary) setPrimary(key);
    else setSecondary(key);
  }

  async function submitVote() {
    if (!activeTarget) return;
    if (!primary || !secondary) {
      setError("Birincil ve ikincil mevki seçmelisin.");
      return;
    }
    const targetMember = teammates.find((t) => t.id === activeTarget);
    if (
      !confirm(
        `${targetMember?.name} için oyun gönderilecek. Bir oyuncuyu yalnızca bir kez oylayabilirsin, sonradan değiştiremezsin. Onaylıyor musun?`
      )
    )
      return;

    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/groups/${groupId}/vote`, {
        targetId: activeTarget,
        scores,
        primaryPosition: primary,
        secondaryPosition: secondary,
      });

      const target = activeTarget;
      setSkillVotes((prev) => [
        ...prev.filter((v) => v.target_id !== target),
        ...SKILLS.map((s) => ({ target_id: target, skill: s.key, score: scores[s.key] })),
      ]);
      setPositionVotes((prev) => [
        ...prev.filter((v) => v.target_id !== target),
        {
          target_id: target,
          primary_position: primary,
          secondary_position: secondary,
        },
      ]);
      setMessage("Oy kaydedildi.");
      setActiveTarget(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Oy kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted">Yükleniyor...</p>;

  return (
    <div>
      <p>
        <Link href={`/group/${groupId}`}>← Takıma dön</Link>
      </p>
      <h1>Oylama</h1>
      <p className="muted" style={{ marginTop: 4 }}>
        Takım arkadaşlarını 6 yetenek üzerinden {MIN_SCORE}-{MAX_SCORE} arası puanla;
        birincil ve ikincil mevkilerini seç. Her oyuncuyu yalnızca bir kez
        oylayabilirsin.
      </p>

      {message && <InlineMessage tone="success">{message}</InlineMessage>}
      {!activeTarget && <ErrorText>{error}</ErrorText>}

      {teammates.length === 0 && (
        <Card>
          <p className="muted" style={{ margin: 0 }}>
            Oy verebileceğin başka üye yok.
          </p>
        </Card>
      )}

      {teammates.map((m) => {
        const open = activeTarget === m.id;
        const voted = votedTargets.has(m.id);

        if (!open) {
          return (
            <Card key={m.id}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{m.name}</strong>
                {voted ? (
                  <Badge tone="brand">Oy verildi</Badge>
                ) : (
                  <Badge tone="neutral">Bekliyor</Badge>
                )}
              </div>
              {voted ? (
                <p className="muted" style={{ margin: "10px 0 0" }}>
                  Oyunu verdin. Oylar bir kez verilir, değiştirilemez.
                </p>
              ) : (
                <button
                  className="secondary full"
                  style={{ marginTop: 12 }}
                  onClick={() => openVoteFor(m.id)}
                >
                  Oyla
                </button>
              )}
            </Card>
          );
        }

        return (
          <Card key={m.id} raised>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2 style={{ margin: 0 }}>{m.name}</h2>
              {voted && <Badge tone="brand">Oy verildi</Badge>}
            </div>

            <div style={{ margin: "16px 0 8px" }}>
              <Eyebrow>MEVKİ — ÖNCE BİRİNCİL, SONRA İKİNCİL</Eyebrow>
            </div>
            <div className="chips">
              {POSITIONS.map((p) => {
                const isPrimary = primary === p.key;
                const isSecondary = secondary === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    className={`chip ${isPrimary ? "chip-on" : ""} ${
                      isSecondary ? "chip-alt" : ""
                    }`}
                    onClick={() => selectPosition(p.key)}
                  >
                    {p.label}
                    {isPrimary ? " (1.)" : isSecondary ? " (2.)" : ""}
                  </button>
                );
              })}
            </div>

            <div style={{ margin: "20px 0 10px" }}>
              <Eyebrow>YETENEKLER</Eyebrow>
            </div>
            {SKILLS.map((s) => (
              <div key={s.key} className="slider-block">
                <div className="slider-head">
                  <label htmlFor={`sk-${m.id}-${s.key}`}>{s.label}</label>
                  <span className="slider-value">{scores[s.key]}</span>
                </div>
                <input
                  id={`sk-${m.id}-${s.key}`}
                  type="range"
                  min={MIN_SCORE}
                  max={MAX_SCORE}
                  step={1}
                  value={scores[s.key]}
                  onChange={(e) =>
                    setScores((prev) => ({ ...prev, [s.key]: Number(e.target.value) }))
                  }
                />
              </div>
            ))}

            <ErrorText>{error}</ErrorText>

            <div className="stack" style={{ marginTop: 16 }}>
              <button onClick={submitVote} disabled={saving}>
                {saving ? "Kaydediliyor..." : "Oyu kaydet"}
              </button>
              <button
                className="secondary"
                onClick={() => setActiveTarget(null)}
                disabled={saving}
              >
                Vazgeç
              </button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
