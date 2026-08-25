"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { SKILLS } from "@/lib/skills";
import { positionLabel } from "@/lib/positions";

type SkillVoteDetail = { voterId: string; voterName: string; score: number };
type PositionVoteDetail = {
  voterId: string;
  voterName: string;
  primary: string;
  secondary: string;
};
type SkillBreakdown = {
  average: number | null;
  voteCount: number;
  votes: SkillVoteDetail[];
};
type PlayerBreakdown = {
  userId: string;
  name: string;
  voteCount: number;
  skills: Record<string, SkillBreakdown>;
  positions: PositionVoteDetail[];
};

export default function BreakdownPage() {
  const params = useParams<{ id: string }>();
  const groupId = params.id;

  const [players, setPlayers] = useState<PlayerBreakdown[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/breakdown`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Puan detayları yüklenemedi.");
        setPlayers([]);
        setIsOwner(Boolean(data.isOwner));
        setIsPublic(Boolean(data.ratingsBreakdownPublic));
        return;
      }
      setPlayers(data.players || []);
      setIsOwner(Boolean(data.isOwner));
      setIsPublic(Boolean(data.ratingsBreakdownPublic));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  async function togglePublic() {
    setToggling(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/breakdown`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public: !isPublic }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Ayar kaydedilemedi.");
        return;
      }
      setIsPublic(Boolean(data.ratingsBreakdownPublic));
    } finally {
      setToggling(false);
    }
  }

  const selected = players.find((p) => p.userId === selectedId) || null;

  if (loading) return <p>Yükleniyor...</p>;

  return (
    <div>
      <p><Link href={`/group/${groupId}`}>← Takıma dön</Link></p>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Puan Detayları</h1>
        <button className="secondary" onClick={() => load(true)} disabled={refreshing}>
          {refreshing ? "Yenileniyor..." : "Yenile"}
        </button>
      </div>
      <p>
        Bir oyuncuya tıklayınca her yetenek için kimden kaç puan aldığını görürsün.
      </p>

      {isOwner && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <strong>Görünürlük</strong>
              <p style={{ margin: "4px 0 0", color: "#666", fontSize: 14 }}>
                {isPublic
                  ? "Şu an tüm takım üyeleri bu sayfayı görebilir."
                  : "Şu an sadece sen (yönetici) bu sayfayı görebilirsin."}
              </p>
            </div>
            <button
              className={isPublic ? "secondary" : undefined}
              onClick={togglePublic}
              disabled={toggling}
            >
              {toggling
                ? "Kaydediliyor..."
                : isPublic
                  ? "Sadece yönetici görsün"
                  : "Herkese açık yap"}
            </button>
          </div>
          {actionError && <p className="error" style={{ marginBottom: 0 }}>{actionError}</p>}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {!error && (
        <>
          <h3>Oyuncular ({players.length})</h3>
          {players.length === 0 ? (
            <p>Bu takımda oyuncu yok.</p>
          ) : (
            <div className="card" style={{ padding: 8 }}>
              {players.map((p) => (
                <button
                  key={p.userId}
                  type="button"
                  className={`player-list-item${selectedId === p.userId ? " active" : ""}`}
                  onClick={() => setSelectedId(p.userId === selectedId ? null : p.userId)}
                >
                  <span>{p.name}</span>
                  <span className="pill">{p.voteCount} oy</span>
                </button>
              ))}
            </div>
          )}

          {players.length > 0 && !selected && (
            <p style={{ color: "#888" }}>Detayları görmek için listeden bir oyuncu seç.</p>
          )}

          {selected && (
            <div>
              <h3>{selected.name}</h3>
              {SKILLS.map((s) => {
                const skill = selected.skills[s.key];
                return (
                  <div key={s.key} className="card">
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <strong>{s.label}</strong>
                      <span className="pill">
                        {skill?.average != null
                          ? `Ort. ${skill.average} · ${skill.voteCount} oy`
                          : "Oy yok"}
                      </span>
                    </div>
                    {!skill?.votes?.length ? (
                      <p style={{ margin: "8px 0 0", color: "#888", fontSize: 14 }}>
                        Bu yetenek için henüz oy yok.
                      </p>
                    ) : (
                      <table style={{ marginTop: 8 }}>
                        <thead>
                          <tr>
                            <th>Oy veren</th>
                            <th>Puan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {skill.votes.map((v) => (
                            <tr key={v.voterId}>
                              <td>{v.voterName}</td>
                              <td><strong>{v.score}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}

              <div className="card">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong>Mevki oyları</strong>
                  <span className="pill">{selected.positions.length} oy</span>
                </div>
                {selected.positions.length === 0 ? (
                  <p style={{ margin: "8px 0 0", color: "#888", fontSize: 14 }}>
                    Bu oyuncu için henüz mevki oyu yok.
                  </p>
                ) : (
                  <table style={{ marginTop: 8 }}>
                    <thead>
                      <tr>
                        <th>Oy veren</th>
                        <th>1. Mevki</th>
                        <th>2. Mevki</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.positions.map((v) => (
                        <tr key={v.voterId}>
                          <td>{v.voterName}</td>
                          <td>{positionLabel(v.primary)}</td>
                          <td>{positionLabel(v.secondary)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
