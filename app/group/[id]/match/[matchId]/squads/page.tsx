"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Card, ErrorText, Eyebrow, InlineMessage, ScoreBadge } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";
import { POSITIONS, PositionKey, formatPositions } from "@/lib/positions";
import { DEFAULT_SCORE, MAX_SCORE, MIN_SCORE, isValidScore } from "@/lib/scoring";

type SquadPlayer = {
  id: string;
  userId: string | null;
  name: string;
  isGuest: boolean;
  overall: number;
  primaryPosition: string | null;
  secondaryPosition: string | null;
};
type Squads = { locked: boolean; home: SquadPlayer[]; away: SquadPlayer[] };

type Detail = {
  match: { match_kind: "ic" | "dis"; status: string };
  isOwner: boolean;
  attendance: { user_id: string; status: "yes" | "no"; name: string }[];
  squads: Squads | null;
};

type GuestDraft = {
  key: string;
  name: string;
  overall: number;
  primaryPosition: PositionKey | "";
  secondaryPosition: PositionKey | "";
};

export default function MatchSquadsPage() {
  const params = useParams<{ id: string; matchId: string }>();
  const { id: groupId, matchId } = params;

  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [guests, setGuests] = useState<GuestDraft[]>([]);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestOverall, setGuestOverall] = useState(DEFAULT_SCORE);
  const [guestPrimary, setGuestPrimary] = useState<PositionKey | "">("");
  const [guestSecondary, setGuestSecondary] = useState<PositionKey | "">("");
  const [guestError, setGuestError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Detail>(`/api/groups/${groupId}/matches/${matchId}`);
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Maç yüklenemedi.");
    }
  }, [groupId, matchId]);

  useEffect(() => {
    load();
  }, [load]);

  function addGuest() {
    setGuestError(null);
    const name = guestName.trim();
    if (!name) return setGuestError("Misafir oyuncu için isim gir.");
    if (!isValidScore(guestOverall))
      return setGuestError(`Güç ${MIN_SCORE}-${MAX_SCORE} arası olmalı.`);
    setGuests((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        name,
        overall: Math.round(guestOverall),
        primaryPosition: guestPrimary,
        secondaryPosition: guestSecondary,
      },
    ]);
    setGuestName("");
    setGuestOverall(DEFAULT_SCORE);
    setGuestPrimary("");
    setGuestSecondary("");
    setGuestOpen(false);
  }

  function removeGuest(key: string) {
    setGuests((prev) => prev.filter((g) => g.key !== key));
  }

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
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/groups/${groupId}/matches/${matchId}/squads`, {
        guests: guests.map((g) => ({
          name: g.name,
          overall: g.overall,
          primaryPosition: g.primaryPosition || null,
          secondaryPosition: g.secondaryPosition || null,
        })),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kadrolar oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function move(playerId: string, toSide: "home" | "away") {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/groups/${groupId}/matches/${matchId}/squads`, {
        action: "move",
        playerId,
        toSide,
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Oyuncu taşınamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleLock(locked: boolean) {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/groups/${groupId}/matches/${matchId}/squads`, {
        action: locked ? "unlock" : "lock",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İşlem başarısız.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div>
        <p>
          <Link className="back-link" href={`/group/${groupId}/match/${matchId}`}>← Maç</Link>
        </p>
        <ErrorText>{error}</ErrorText>
        {!error && <p className="muted">Yükleniyor...</p>}
      </div>
    );
  }

  if (data.match.match_kind !== "ic") {
    return (
      <div>
        <p>
          <Link className="back-link" href={`/group/${groupId}/match/${matchId}`}>← Maç</Link>
        </p>
        <Card>
          <p className="muted" style={{ margin: 0 }}>
            Kadrolar yalnızca takım içi maçlarda kullanılır.
          </p>
        </Card>
      </div>
    );
  }

  const attendees = data.attendance.filter((a) => a.status === "yes");
  const squads = data.squads;
  const locked = squads?.locked ?? false;
  const canManage = data.isOwner && data.match.status !== "cancelled";

  return (
    <div>
      <p>
        <Link className="back-link" href={`/group/${groupId}/match/${matchId}`}>← Maç</Link>
      </p>
      <h1>Kadrolar</h1>
      <p className="muted" style={{ marginTop: 4 }}>
        Yoklamaya katılıyorum diyen {attendees.length} oyuncu, güç ve mevki dağılımına
        göre iki takıma bölünür.
      </p>

      <ErrorText>{error}</ErrorText>

      {attendees.length < 2 && !squads && (
        <Card>
          <p className="muted" style={{ margin: 0 }}>
            Kadro oluşturmak için en az 2 oyuncunun yoklamaya katılıyorum demesi
            gerekir.
          </p>
        </Card>
      )}

      {canManage && !locked && (
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

          {guests.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {guests.map((g) => (
                <div key={g.key} className="row" style={{ flexWrap: "nowrap", gap: 4 }}>
                  <span className="grow">
                    {g.name} <span className="pill">misafir</span> · {g.overall}
                  </span>
                  <button
                    type="button"
                    className="danger small"
                    onClick={() => removeGuest(g.key)}
                    aria-label={`${g.name} misafirini kaldır`}
                  >
                    Sil
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            className="full"
            style={{ marginTop: 12 }}
            disabled={busy || attendees.length + guests.length < 2}
            onClick={generate}
          >
            {squads ? "Kadroları karıştır" : "Kadroları oluştur"}
          </button>
        </Card>
      )}

      {locked && canManage && (
        <InlineMessage tone="neutral">
          Kadro kilitli. Değiştirmek için önce kilidi açmalısın.
        </InlineMessage>
      )}

      {squads && (
        <>
          <SquadCard
            title="Takım 1"
            players={squads.home}
            locked={locked}
            canManage={canManage}
            busy={busy}
            onMove={(playerId) => move(playerId, "away")}
            moveLabel="Takım 2'ye taşı"
          />
          <SquadCard
            title="Takım 2"
            players={squads.away}
            locked={locked}
            canManage={canManage}
            busy={busy}
            onMove={(playerId) => move(playerId, "home")}
            moveLabel="Takım 1'e taşı"
          />

          {canManage && (
            <button
              className={locked ? "secondary full" : "full"}
              style={{ marginTop: 16 }}
              disabled={busy}
              onClick={() => toggleLock(locked)}
            >
              {locked ? "Kilidi aç" : "Kadroyu kilitle"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function SquadCard({
  title,
  players,
  locked,
  canManage,
  busy,
  onMove,
  moveLabel,
}: {
  title: string;
  players: SquadPlayer[];
  locked: boolean;
  canManage: boolean;
  busy: boolean;
  onMove: (playerId: string) => void;
  moveLabel: string;
}) {
  const total = players.reduce((sum, p) => sum + p.overall, 0);
  const avg = players.length > 0 ? Math.round((total / players.length) * 10) / 10 : 0;

  return (
    <Card raised style={{ marginTop: 12 }}>
      <div className="team-head">
        <div>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <span className="muted">{players.length} oyuncu</span>
        </div>
        <ScoreBadge value={avg} label="ORT. GÜÇ" />
      </div>

      <div className="roster">
        {players.map((p) => (
          <div key={p.id} className="roster-row">
            <span className="grow">
              <span className="roster-name">{p.name}</span>
              {p.isGuest && (
                <span className="pill" style={{ marginLeft: 6 }}>
                  misafir
                </span>
              )}
              <div className="roster-meta">
                {formatPositions(p.primaryPosition, p.secondaryPosition)}
              </div>
            </span>
            <span className="roster-score">{p.overall}</span>
          </div>
        ))}
        {players.length === 0 && (
          <p className="muted" style={{ margin: "8px 0 0" }}>
            Bu takımda henüz oyuncu yok.
          </p>
        )}
      </div>

      {canManage && !locked && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {players.map((p) => (
            <button
              key={p.id}
              type="button"
              className="secondary small"
              disabled={busy}
              onClick={() => onMove(p.id)}
            >
              {p.name}: {moveLabel}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
