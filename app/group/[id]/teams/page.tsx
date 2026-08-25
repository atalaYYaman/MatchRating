"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type TeamPlayer = { userId: string; name: string; overall: number };
type Team = {
  index: number;
  players: TeamPlayer[];
  totalRating: number;
  averageRating: number;
};

export default function TeamsPage() {
  const params = useParams<{ id: string }>();
  const groupId = params.id;

  const [teamCount, setTeamCount] = useState(2);
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamCount }),
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

  return (
    <div>
      <p><Link href={`/group/${groupId}`}>← Takıma dön</Link></p>
      <h1>Rastgele Dengeli Takımlar</h1>
      <p>
        Oylama sonuçlarına göre oyuncuların gücü hesaplanır; oyuncular
        rastgele fakat takımların toplam gücü birbirine yakın olacak şekilde
        dağıtılır. Her tıklamada farklı bir dağılım çıkabilir.
      </p>

      <div className="card row">
        <label>Takım sayısı:</label>
        <input
          type="number"
          min={2}
          max={10}
          value={teamCount}
          onChange={(e) => setTeamCount(Number(e.target.value))}
          style={{ width: 70 }}
        />
        <button onClick={generate} disabled={loading}>
          {loading ? "Oluşturuluyor..." : "Takımları Oluştur"}
        </button>
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
              <ul>
                {t.players.map((p) => (
                  <li key={p.userId}>
                    {p.name} <span style={{ color: "#888" }}>({p.overall})</span>
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
