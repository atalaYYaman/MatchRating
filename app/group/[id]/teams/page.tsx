"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { POSITIONS, formatPositions } from "@/lib/positions";

type Member = { id: string; name: string; email: string };
type TeamPlayer = {
  userId: string;
  name: string;
  overall: number;
  primaryPosition: string | null;
  secondaryPosition: string | null;
};
type Team = {
  index: number;
  players: TeamPlayer[];
  totalRating: number;
  averageRating: number;
  positionCounts: Record<string, number>;
};

export default function TeamsPage() {
  const params = useParams<{ id: string }>();
  const groupId = params.id;

  const [members, setMembers] = useState<Member[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [teamCount, setTeamCount] = useState(2);
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/groups/${groupId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Takım yüklenemedi.");
        setLoadingMembers(false);
        return;
      }
      const list = (data.members || []) as Member[];
      setMembers(list);
      setSelectedIds(new Set(list.map((m) => m.id)));
      setLoadingMembers(false);
    }
    load();
  }, [groupId]);

  function togglePlayer(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(members.map((m) => m.id)));
  }

  function selectNone() {
    setSelectedIds(new Set());
  }

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamCount, playerIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Takımlar oluşturulamadı.");
        setTeams(null);
        return;
      }
      setTeams(data.teams);
    } finally {
      setLoading(false);
    }
  }

  const selectedCount = selectedIds.size;
  const canGenerate = !loading && !loadingMembers && selectedCount >= teamCount;

  return (
    <div>
      <p><Link href={`/group/${groupId}`}>← Takıma dön</Link></p>
      <h1>Rastgele Dengeli Takımlar</h1>
      <p>
        Oylama sonuçlarına göre oyuncuların gücü ve mevkileri hesaplanır;
        oyuncular rastgele fakat takımların toplam gücü ve mevki adetleri
        birbirine yakın olacak şekilde dağıtılır. Her tıklamada farklı bir
        dağılım çıkabilir.
      </p>

      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <label>Takım sayısı:</label>
          <input
            type="number"
            min={2}
            max={10}
            value={teamCount}
            onChange={(e) => setTeamCount(Number(e.target.value))}
            style={{ width: 70 }}
          />
          <button onClick={generate} disabled={!canGenerate}>
            {loading ? "Oluşturuluyor..." : "Takımları Oluştur"}
          </button>
        </div>
        {!loadingMembers && selectedCount < teamCount && (
          <p className="error" style={{ marginTop: 0 }}>
            En az {teamCount} oyuncu seçmelisin.
          </p>
        )}

        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <strong>Oyuncular ({selectedCount}/{members.length})</strong>
          <span className="row" style={{ gap: 12, fontSize: 14 }}>
            <button type="button" className="secondary" onClick={selectAll} disabled={loadingMembers}>
              Tümünü seç
            </button>
            <button type="button" className="secondary" onClick={selectNone} disabled={loadingMembers}>
              Seçimi kaldır
            </button>
          </span>
        </div>

        {loadingMembers ? (
          <p>Üyeler yükleniyor...</p>
        ) : members.length === 0 ? (
          <p>Bu takımda oyuncu yok.</p>
        ) : (
          members.map((m) => (
            <label key={m.id} className="player-pick">
              <input
                type="checkbox"
                checked={selectedIds.has(m.id)}
                onChange={() => togglePlayer(m.id)}
              />
              <span>{m.name}</span>
            </label>
          ))
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {teams && (
        <div>
          {teams.map((t) => (
            <div key={t.index} className="team-box">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h3>Takım {t.index + 1}</h3>
                <span className="pill">Ort. güç: {t.averageRating}</span>
              </div>
              <p className="pos-summary">
                {POSITIONS.map((p) => `${p.label} ${t.positionCounts?.[p.key] ?? 0}`).join(" · ")}
              </p>
              <ul>
                {t.players.map((p) => (
                  <li key={p.userId}>
                    {p.name}{" "}
                    <span style={{ color: "#888" }}>
                      ({p.overall}) · {formatPositions(p.primaryPosition, p.secondaryPosition)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
