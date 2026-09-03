"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge, Card, ErrorText, Eyebrow, ScoreBadge } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";
import { POSITIONS, PositionKey, formatPositions } from "@/lib/positions";
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
  const [error, setError] = useState<string | null>(null);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestOverall, setGuestOverall] = useState(DEFAULT_SCORE);
  const [guestPrimary, setGuestPrimary] = useState<PositionKey | "">("");
  const [guestSecondary, setGuestSecondary] = useState<PositionKey | "">("");
  const knownIdsRef = useRef<Set<string>>(new Set());
  const guestIdsRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ members: Member[] }>(`/api/groups/${groupId}`);
      const list = data.members ?? [];
      const oldIds = knownIdsRef.current;
      knownIdsRef.current = new Set(list.map((m) => m.id));
      setMembers(list);
      // Yeni katilan uyeler varsayilan olarak kadroda; onceki secim korunur.
      setSelectedIds((prev) => {
        const next = new Set<string>();
        for (const m of list) {
          if (prev.has(m.id) || !oldIds.has(m.id)) next.add(m.id);
        }
        for (const id of guestIdsRef.current) {
          if (prev.has(id)) next.add(id);
        }
        return next;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Takım yüklenemedi.");
    } finally {
      setLoadingMembers(false);
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

  function addGuest() {
    setGuestError(null);
    const name = guestName.trim();
    if (!name) return setGuestError("Misafir oyuncu için isim gir.");
    if (!isValidScore(guestOverall))
      return setGuestError(`Güç ${MIN_SCORE}-${MAX_SCORE} arası olmalı.`);
    if (!guestPrimary) return setGuestError("Birincil mevki seç.");
    if (!guestSecondary) return setGuestError("İkincil mevki seç.");
    if (guests.length >= MAX_GUESTS)
      return setGuestError(`En fazla ${MAX_GUESTS} misafir ekleyebilirsin.`);

    const id = newGuestId();
    setGuests((prev) => [
      ...prev,
      {
        id,
        name,
        overall: Math.round(guestOverall),
        primaryPosition: guestPrimary,
        secondaryPosition: guestSecondary,
      },
    ]);
    guestIdsRef.current = new Set([...guestIdsRef.current, id]);
    setSelectedIds((prev) => new Set(prev).add(id));
    setGuestName("");
    setGuestOverall(DEFAULT_SCORE);
    setGuestPrimary("");
    setGuestSecondary("");
    setGuestOpen(false);
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

  // Misafirde birincil ve ikincil ayni olamaz; birincil degisince cakisan
  // ikincil temizlenir.
  function pickGuestPosition(key: PositionKey) {
    if (guestPrimary === key) {
      setGuestPrimary(guestSecondary || "");
      setGuestSecondary("");
      return;
    }
    if (guestSecondary === key) {
      setGuestSecondary("");
      return;
    }
    if (!guestPrimary) setGuestPrimary(key);
    else setGuestSecondary(key);
  }

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const memberIds = new Set(members.map((m) => m.id));
      const data = await api.post<{ teams: Team[] }>(`/api/groups/${groupId}/teams`, {
        teamCount,
        playerIds: [...selectedIds].filter((id) => memberIds.has(id)),
        guests: guests
          .filter((g) => selectedIds.has(g.id))
          .map((g) => ({
            id: g.id,
            name: g.name,
            overall: g.overall,
            primaryPosition: g.primaryPosition,
            secondaryPosition: g.secondaryPosition || null,
          })),
      });
      setTeams(data.teams);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Takımlar oluşturulamadı.");
      setTeams(null);
    } finally {
      setLoading(false);
    }
  }

  const selectedCount = selectedIds.size;
  const canGenerate = !loading && !loadingMembers && selectedCount >= teamCount;

  return (
    <div>
      <p>
        <Link href={`/group/${groupId}`}>← Takıma dön</Link>
      </p>
      <h1>Takımları Oluştur</h1>
      <p className="muted" style={{ marginTop: 4 }}>
        Kadroyu seç, sistem oyuncuları güç ve mevki dağılımına göre dengeli takımlara
        böler.
      </p>

      <ErrorText>{error}</ErrorText>

      <Card>
        <Eyebrow>TAKIM SAYISI</Eyebrow>
        <div className="stepper" style={{ marginTop: 10 }}>
          <button
            type="button"
            aria-label="Azalt"
            onClick={() => setTeamCount((n) => Math.max(2, n - 1))}
          >
            −
          </button>
          <span className="stepper-value">{teamCount}</span>
          <button type="button" aria-label="Artır" onClick={() => setTeamCount((n) => n + 1)}>
            +
          </button>
        </div>
      </Card>

      <Card>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <Eyebrow>KADRO</Eyebrow>
          <span className="row" style={{ gap: 6 }}>
            <span className="slider-value">{selectedCount}</span>
            <Eyebrow>SEÇİLİ</Eyebrow>
          </span>
        </div>

        <div className="row" style={{ gap: 8, margin: "12px 0 4px" }}>
          <button
            type="button"
            className="secondary small"
            onClick={() =>
              setSelectedIds(
                new Set([...members.map((m) => m.id), ...guests.map((g) => g.id)])
              )
            }
          >
            Tümünü seç
          </button>
          <button
            type="button"
            className="secondary small"
            onClick={() => setSelectedIds(new Set())}
          >
            Hiçbiri
          </button>
        </div>

        {loadingMembers && <p className="muted">Yükleniyor...</p>}

        {members.map((m) => {
          const on = selectedIds.has(m.id);
          return (
            <button
              key={m.id}
              type="button"
              className={`pick ${on ? "pick-on" : ""}`}
              onClick={() => togglePlayer(m.id)}
              aria-pressed={on}
            >
              <span className="grow">{m.name}</span>
              <span className="pick-mark">{on ? "✓ Kadroda" : "Hariç"}</span>
            </button>
          );
        })}

        {guests.map((g) => {
          const on = selectedIds.has(g.id);
          return (
            <div key={g.id} className="row" style={{ flexWrap: "nowrap", gap: 4 }}>
              <button
                type="button"
                className={`pick ${on ? "pick-on" : ""}`}
                onClick={() => togglePlayer(g.id)}
                aria-pressed={on}
              >
                <span className="grow">
                  {g.name} <span className="pill">misafir</span>
                </span>
                <span className="pick-mark">
                  {g.overall} · {on ? "✓" : "hariç"}
                </span>
              </button>
              <button
                type="button"
                className="danger small"
                onClick={() => removeGuest(g.id)}
                aria-label={`${g.name} misafirini kaldır`}
              >
                Sil
              </button>
            </div>
          );
        })}
      </Card>

      <Card>
        <button
          type="button"
          className="disclosure"
          onClick={() => setGuestOpen((v) => !v)}
          aria-expanded={guestOpen}
        >
          Misafir oyuncu ekle
          <span aria-hidden="true">{guestOpen ? "−" : "+"}</span>
        </button>

        {guestOpen && (
          <div style={{ marginTop: 8 }}>
            <p className="muted" style={{ marginTop: 0 }}>
              Uygulamada hesabı olmayan arkadaşlarını kadroya elle ekleyebilirsin.
            </p>

            <div className="field">
              <label htmlFor="guest-name">İsim</label>
              <input
                id="guest-name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Misafir adı"
              />
            </div>

            <div className="slider-block" style={{ marginBottom: 16 }}>
              <div className="slider-head">
                <label htmlFor="guest-overall">Güç puanı</label>
                <span className="slider-value">{guestOverall}</span>
              </div>
              <input
                id="guest-overall"
                type="range"
                min={MIN_SCORE}
                max={MAX_SCORE}
                step={1}
                value={guestOverall}
                onChange={(e) => setGuestOverall(Number(e.target.value))}
              />
            </div>

            <Eyebrow>MEVKİ — ÖNCE BİRİNCİL, SONRA İKİNCİL</Eyebrow>
            <div className="chips" style={{ marginTop: 8 }}>
              {POSITIONS.map((p) => {
                const isPrimary = guestPrimary === p.key;
                const isSecondary = guestSecondary === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    className={`chip ${isPrimary ? "chip-on" : ""} ${
                      isSecondary ? "chip-alt" : ""
                    }`}
                    onClick={() => pickGuestPosition(p.key)}
                  >
                    {p.label}
                    {isPrimary ? " (1.)" : isSecondary ? " (2.)" : ""}
                  </button>
                );
              })}
            </div>

            <ErrorText>{guestError}</ErrorText>

            <button
              type="button"
              className="secondary full"
              style={{ marginTop: 12 }}
              onClick={addGuest}
            >
              Misafiri ekle
            </button>
          </div>
        )}
      </Card>

      <button className="full" onClick={generate} disabled={!canGenerate}>
        {loading ? "Oluşturuluyor..." : "Takımları oluştur"}
      </button>
      {!canGenerate && !loading && !loadingMembers && (
        <p className="muted" style={{ textAlign: "center", marginTop: 8 }}>
          Takım sayısından az oyuncu seçili.
        </p>
      )}

      {teams && (
        <div style={{ marginTop: 28 }}>
          <Eyebrow>SONUÇ</Eyebrow>
          {teams.map((t) => (
            <Card key={t.index} raised style={{ marginTop: 10 }}>
              <div className="team-head">
                <div>
                  <h2 style={{ margin: 0 }}>Takım {t.index + 1}</h2>
                  <span className="muted">{t.players.length} oyuncu</span>
                </div>
                <ScoreBadge value={t.averageRating} label="ORT. GÜÇ" />
              </div>

              <div className="roster">
                {t.players.map((p) => (
                  <div key={p.userId} className="roster-row">
                    <span className="grow">
                      <span className="roster-name">{p.name}</span>
                      {p.isGuest && <span className="pill" style={{ marginLeft: 6 }}>misafir</span>}
                      <div className="roster-meta">
                        {formatPositions(p.primaryPosition, p.secondaryPosition)}
                      </div>
                    </span>
                    <span className="roster-score">{p.overall}</span>
                  </div>
                ))}
              </div>

              <p className="muted" style={{ margin: "12px 0 0" }}>
                {POSITIONS.map((p) => `${p.label} ${t.positionCounts?.[p.key] ?? 0}`).join(
                  " · "
                )}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
