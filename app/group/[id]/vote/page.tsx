"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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
  const [primaryPosition, setPrimaryPosition] = useState<PositionKey | "">("");
  const [secondaryPosition, setSecondaryPosition] = useState<PositionKey | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [meRes, groupRes, votesRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch(`/api/groups/${groupId}`),
        fetch(`/api/groups/${groupId}/vote`),
      ]);
      const me = await meRes.json();
      const groupData = await groupRes.json();
      const votesData = await votesRes.json();

      if (!groupRes.ok) {
        setError(groupData.error || "Takım yüklenemedi.");
        setLoading(false);
        return;
      }

      setMeId(me.user?.id || null);
      setMembers(groupData.members);

      if (votesRes.ok) {
        setSkillVotes((votesData.votes as ExistingVote[]) || []);
        setPositionVotes((votesData.positionVotes as ExistingPositionVote[]) || []);
      }
      setLoading(false);
    }
    load();
  }, [groupId]);

  const teammates = useMemo(
    () => members.filter((m) => m.id !== meId),
    [members, meId]
  );

  const votedTargets = useMemo(() => {
    const bySkillCount = new Map<string, number>();
    for (const v of skillVotes) {
      bySkillCount.set(v.target_id, (bySkillCount.get(v.target_id) || 0) + 1);
    }
    const withPosition = new Set(positionVotes.map((v) => v.target_id));
    const completed = new Set<string>();
    for (const [targetId, count] of bySkillCount) {
      if (count >= SKILLS.length && withPosition.has(targetId)) completed.add(targetId);
    }
    return completed;
  }, [skillVotes, positionVotes]);

  function openVoteFor(targetId: string) {
    const nextScores = { ...DEFAULT_SCORES };
    for (const v of skillVotes) {
      if (v.target_id === targetId && v.skill in nextScores) {
        nextScores[v.skill as SkillKey] = v.score;
      }
    }
    setScores(nextScores);

    const existingPos = positionVotes.find((v) => v.target_id === targetId);
    const existingPrimary = existingPos?.primary_position;
    const existingSecondary = existingPos?.secondary_position;
    setPrimaryPosition(isPositionKey(existingPrimary) ? existingPrimary : "");
    setSecondaryPosition(isPositionKey(existingSecondary) ? existingSecondary : "");

    setActiveTarget(targetId);
    setMessage(null);
    setError(null);
  }

  async function submitVote() {
    if (!activeTarget) return;
    if (!primaryPosition || !secondaryPosition) {
      setError("Birincil ve ikincil mevki seçmelisin.");
      return;
    }
    if (primaryPosition === secondaryPosition) {
      setError("Birincil ve ikincil mevki farklı olmalı.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: activeTarget,
          scores,
          primaryPosition,
          secondaryPosition,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Oy kaydedilemedi.");
        return;
      }
      setSkillVotes((prev) => {
        const others = prev.filter((v) => v.target_id !== activeTarget);
        return [
          ...others,
          ...SKILLS.map((s) => ({
            target_id: activeTarget,
            skill: s.key,
            score: scores[s.key],
          })),
        ];
      });
      setPositionVotes((prev) => {
        const others = prev.filter((v) => v.target_id !== activeTarget);
        return [
          ...others,
          {
            target_id: activeTarget,
            primary_position: primaryPosition,
            secondary_position: secondaryPosition,
          },
        ];
      });
      setMessage("Oy kaydedildi.");
      setActiveTarget(null);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Yükleniyor...</p>;
  if (error && teammates.length === 0) return <p className="error">{error}</p>;

  return (
    <div>
      <p><Link href={`/group/${groupId}`}>← Takıma dön</Link></p>
      <h1>Oylama</h1>
      <p>
        Takım arkadaşlarını 6 yetenek üzerinden {MIN_SCORE}-{MAX_SCORE} arası
        puanla; birincil ve ikincil mevki seç.
      </p>
      {message && <p style={{ color: "green" }}>{message}</p>}

      {teammates.length === 0 && <p>Oylayacağın başka üye yok.</p>}

      {teammates.map((m) => (
        <div key={m.id} className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{m.name}</strong>
            {votedTargets.has(m.id) ? (
              <span className="pill">Oylandı ✓</span>
            ) : (
              <span className="pill">Bekliyor</span>
            )}
          </div>

          {activeTarget === m.id ? (
            <div style={{ marginTop: 12 }}>
              <div className="pos-selects">
                <div className="field">
                  <label>Birincil mevki</label>
                  <select
                    value={primaryPosition}
                    onChange={(e) => {
                      const value = e.target.value as PositionKey | "";
                      setPrimaryPosition(value);
                      if (value && value === secondaryPosition) setSecondaryPosition("");
                    }}
                  >
                    <option value="">Seç</option>
                    {POSITIONS.map((p) => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>İkincil mevki</label>
                  <select
                    value={secondaryPosition}
                    onChange={(e) => setSecondaryPosition(e.target.value as PositionKey | "")}
                  >
                    <option value="">Seç</option>
                    {POSITIONS.filter((p) => p.key !== primaryPosition).map((p) => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {SKILLS.map((s) => (
                <div key={s.key} className="field">
                  <label>
                    {s.label}: <strong>{scores[s.key]}</strong>
                  </label>
                  <input
                    type="range"
                    min={MIN_SCORE}
                    max={MAX_SCORE}
                    step={1}
                    value={scores[s.key]}
                    onChange={(e) =>
                      setScores((prev) => ({ ...prev, [s.key]: Number(e.target.value) }))
                    }
                  />
                  <div className="row" style={{ justifyContent: "space-between", color: "#888", fontSize: 12 }}>
                    <span>{MIN_SCORE}</span>
                    <span>{MAX_SCORE}</span>
                  </div>
                </div>
              ))}
              {error && <p className="error">{error}</p>}
              <div className="row">
                <button onClick={submitVote} disabled={saving}>
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </button>
                <button className="secondary" onClick={() => setActiveTarget(null)}>
                  İptal
                </button>
              </div>
            </div>
          ) : (
            <button
              className="secondary"
              style={{ marginTop: 8 }}
              onClick={() => openVoteFor(m.id)}
            >
              {votedTargets.has(m.id) ? "Puanları Güncelle" : "Oyla"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
