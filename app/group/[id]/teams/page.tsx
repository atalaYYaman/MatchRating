"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  POSITIONS,
  PositionKey,
  formatPositions,
} from "@/lib/positions";
import { DEFAULT_SCORE, MAX_SCORE, MIN_SCORE, isValidScore } from "@/lib/scoring";

const GUEST_PREFIX = "guest-";
const MAX_GUESTS = 20;

type Member = { id: string; name: string; email: string };
type GuestPlayer = {
  id: string;
  name: string;
  overall: number;
  primaryPosition: PositionKey;
  secondaryPosition: PositionKey | "";
};
type TeamPlayer = {
  userId: string;
  name: string;
  overall: number;
  primaryPosition: string | null;
  secondaryPosition: string | null;
  isGuest?: boolean;
};
type Team = {
  index: number;
  players: TeamPlayer[];
  totalRating: number;
  averageRating: number;
  positionCounts: Record<string, number>;
};

function newGuestId() {
  return `${GUEST_PREFIX}${crypto.randomUUID()}`;
}

export default function TeamsPage() {
  const params = useParams<{ id: string }>();
  const groupId = params.id;

  const [members, setMembers] = useState<Member[]>([]);
  const [guests, setGuests] = useState<GuestPlayer[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [teamCount, setTeamCount] = useState(2);
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestOverall, setGuestOverall] = useState(DEFAULT_SCORE);
  const [guestPrimary, setGuestPrimary] = useState<PositionKey | "">("");
  const [guestSecondary, setGuestSecondary] = useState<PositionKey | "">("");
  const knownIdsRef = useRef<Set<string>>(new Set());
  const guestIdsRef = useRef<Set<string>>(new Set());

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoadingMembers(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Takım yüklenemedi.");
        return;
      }
      const list = (data.members || []) as Member[];
      const oldIds = knownIdsRef.current;
      knownIdsRef.current = new Set(list.map((m) => m.id));
      setMembers(list);
      setSelectedIds((prevSelected) => {
        const next = new Set<string>();
        for (const m of list) {
          if (prevSelected.has(m.id) || !oldIds.has(m.id)) next.add(m.id);
        }
        for (const id of guestIdsRef.current) {
          if (prevSelected.has(id)) next.add(id);
        }
        return next;
      });
      setError(null);
    } finally {
      setLoadingMembers(false);
      setRefreshing(false);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  function togglePlayer(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set([...members.map((m) => m.id), ...guests.map((g) => g.id)]));
  }

  function selectNone() {
    setSelectedIds(new Set());
  }

  function addGuest() {
    setGuestError(null);
    const name = guestName.trim();
    if (!name) {
      setGuestError("Misafir oyuncu için isim gir.");
      return;
    }
    if (!isValidScore(guestOverall)) {
      setGuestError(`Güç ${MIN_SCORE}-${MAX_SCORE} arası olmalı.`);
      return;
    }
    if (!guestPrimary) {
      setGuestError("Birincil mevki seç.");
      return;
    }
    if (!guestSecondary) {
      setGuestError("İkincil mevki seç.");
      return;
    }
    if (guestPrimary === guestSecondary) {
      setGuestError("Birincil ve ikincil mevki farklı olmalı.");
      return;
    }
    if (guests.length >= MAX_GUESTS) {
      setGuestError(`En fazla ${MAX_GUESTS} misafir ekleyebilirsin.`);
      return;
    }

    const id = newGuestId();
    const guest: GuestPlayer = {
      id,
      name,
      overall: Math.round(guestOverall),
      primaryPosition: guestPrimary,
      secondaryPosition: guestSecondary,
    };
    setGuests((prev) => [...prev, guest]);
    guestIdsRef.current = new Set([...guestIdsRef.current, id]);
    setSelectedIds((prev) => new Set(prev).add(id));
    setGuestName("");
    setGuestOverall(DEFAULT_SCORE);
    setGuestPrimary("");
    setGuestSecondary("");
  }

  function removeGuest(id: string) {
    setGuests((prev) => prev.filter((g) => g.id !== id));
    guestIdsRef.current.delete(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const memberIds = members.map((m) => m.id);
      const res = await fetch(`/api/groups/${groupId}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamCount,
          playerIds: Array.from(selectedIds).filter((id) => memberIds.includes(id)),
          guests: guests
            .filter((g) => selectedIds.has(g.id))
            .map((g) => ({
              id: g.id,
              name: g.name,
              overall: g.overall,
              primaryPosition: g.primaryPosition,
              secondaryPosition: g.secondaryPosition || null,
            })),
        }),
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

  const totalPlayers = members.length + guests.length;
  const selectedCount = selectedIds.size;
  const canGenerate = !loading && !loadingMembers && selectedCount >= teamCount;

  return (
    <div>
      <p><Link href={`/group/${groupId}`}>← Takıma dön</Link></p>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Rastgele Dengeli Takımlar</h1>
        <button className="secondary" onClick={() => load(true)} disabled={refreshing || loadingMembers}>
          {refreshing ? "Yenileniyor..." : "Listeyi Yenile"}
        </button>
      </div>
      <p>
        Oylama sonuçlarına göre oyuncuların gücü ve mevkileri hesaplanır;
        oyuncular rastgele fakat takımların toplam gücü ve mevki adetleri
        birbirine yakın olacak şekilde dağıtılır. Sistemde olmayanları misafir
        olarak ekleyebilirsin — sadece bu sayfada kullanılır, kaydedilmez.
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
          <strong>Oyuncular ({selectedCount}/{totalPlayers})</strong>
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
        ) : (
          <>
            {members.map((m) => (
              <label key={m.id} className="player-pick">
                <input
                  type="checkbox"
                  checked={selectedIds.has(m.id)}
                  onChange={() => togglePlayer(m.id)}
                />
                <span>{m.name}</span>
              </label>
            ))}
            {guests.map((g) => (
              <div key={g.id} className="player-pick">
                <label className="player-pick-main">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(g.id)}
                    onChange={() => togglePlayer(g.id)}
                  />
                  <span>{g.name}</span>
                  <span className="pill">misafir</span>
                  <span style={{ color: "#888", fontSize: 13 }}>
                    ({g.overall}) · {formatPositions(g.primaryPosition, g.secondaryPosition || null)}
                  </span>
                </label>
                <button
                  type="button"
                  className="danger small"
                  onClick={() => removeGuest(g.id)}
                >
                  Kaldır
                </button>
              </div>
            ))}
            {members.length === 0 && guests.length === 0 && (
              <p>Bu takımda oyuncu yok.</p>
            )}
          </>
        )}

        <div className="guest-form">
          <strong>Misafir oyuncu ekle</strong>
          <p style={{ margin: "4px 0 12px", color: "#666", fontSize: 13 }}>
            Sistemde kaydı olmayan oyuncu için güç ve mevki belirle. Sadece bu
            sayfada kalır; sayfadan çıkınca silinir.
          </p>
          <div className="field">
            <label htmlFor="guest-name">İsim</label>
            <input
              id="guest-name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addGuest();
                }
              }}
              placeholder="Oyuncu adı"
              maxLength={40}
              disabled={loadingMembers}
            />
          </div>
          <div className="field">
            <label htmlFor="guest-overall">
              Güç: <strong>{guestOverall}</strong>
            </label>
            <input
              id="guest-overall"
              type="range"
              min={MIN_SCORE}
              max={MAX_SCORE}
              step={1}
              value={guestOverall}
              onChange={(e) => setGuestOverall(Number(e.target.value))}
              disabled={loadingMembers}
            />
            <div className="row" style={{ justifyContent: "space-between", color: "#888", fontSize: 12 }}>
              <span>{MIN_SCORE}</span>
              <span>{MAX_SCORE}</span>
            </div>
          </div>
          <div className="pos-selects">
            <div className="field">
              <label htmlFor="guest-primary">Birincil mevki</label>
              <select
                id="guest-primary"
                value={guestPrimary}
                onChange={(e) => {
                  const value = e.target.value as PositionKey | "";
                  setGuestPrimary(value);
                  if (value && value === guestSecondary) setGuestSecondary("");
                }}
                disabled={loadingMembers}
              >
                <option value="">Seç</option>
                {POSITIONS.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="guest-secondary">İkincil mevki</label>
              <select
                id="guest-secondary"
                value={guestSecondary}
                onChange={(e) => setGuestSecondary(e.target.value as PositionKey | "")}
                disabled={loadingMembers}
              >
                <option value="">Seç</option>
                {POSITIONS.filter((p) => p.key !== guestPrimary).map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
          {guestError && <p className="error">{guestError}</p>}
          <button type="button" onClick={addGuest} disabled={loadingMembers}>
            Misafir Ekle
          </button>
        </div>
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
                    {p.name}
                    {p.isGuest && <span className="pill" style={{ marginLeft: 6 }}>misafir</span>}
                    {" "}
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
