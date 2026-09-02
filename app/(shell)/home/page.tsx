"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Card, ErrorText, Eyebrow, ScoreBadge } from "@/components/ui";
import { TeamSwitcher } from "@/components/TeamSwitcher";
import { api, ApiError } from "@/lib/client-api";
import { useActiveGroup } from "@/lib/active-group";
import {
  clockTime,
  countdownLabel,
  dayNumber,
  monthAndDay,
  shortDate,
} from "@/lib/dateFormat";

type UpcomingMatch = {
  id: string;
  groupId: string;
  groupName: string;
  scheduledAt: string;
  location: string | null;
  matchKind: string;
  format: string | null;
  requiredPlayers: number | null;
  attendingCount: number;
  attendingNames: string[];
  myAttendance: "yes" | "no" | null;
};

type HomeData = {
  scope: "all" | "group";
  group: { id: string; name: string; inviteCode: string } | null;
  groupCount: number;
  isOwner: boolean;
  upcomingMatches: UpcomingMatch[];
  monthStats: {
    played: number;
    wins: number;
    draws: number;
    losses: number;
    streak: number;
    recentResults: (string | null)[];
  };
  lastMatch: {
    id: string;
    groupId: string;
    groupName: string;
    scheduledAt: string;
    homeScore: number | null;
    awayScore: number | null;
    homeLabel: string | null;
    outcome: "win" | "draw" | "loss" | null;
    hasScore: boolean;
    mvp: { id: string; name: string; average: number } | null;
    ratingOpen: boolean;
    pendingRatings: number;
  } | null;
};

export default function HomePage() {
  const { scopeId, isAll, groups, loading: groupsLoading } = useActiveGroup();

  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);

  // Kapsam degistiginde onceki istek hala ucuyor olabilir; gec donen eski
  // yanit yenisini ezmesin diye istegin kapsami guncel kapsamla karsilastirilir.
  const scopeRef = useRef(scopeId);
  scopeRef.current = scopeId;

  const load = useCallback(async () => {
    const requested = scopeId;
    try {
      const query = requested ? `?groupId=${requested}` : "";
      const res = await api.get<HomeData>(`/api/home${query}`);
      if (scopeRef.current !== requested) return;
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function setAttendance(match: UpcomingMatch, status: "yes" | "no") {
    setBusyMatchId(match.id);
    try {
      // Mac kendi takimina ait; "tum takimlar" gorunumunde de dogru adrese gider.
      await api.post(`/api/groups/${match.groupId}/matches/${match.id}/attendance`, {
        status,
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Yoklama kaydedilemedi.");
    } finally {
      setBusyMatchId(null);
    }
  }

  if (groupsLoading || (loading && !data)) {
    return <p className="muted">Yükleniyor...</p>;
  }

  if (groups.length === 0) {
    return (
      <Card>
        <h2>Henüz bir takımın yok</h2>
        <p className="muted">
          Takımlarım sekmesinden yeni bir takım kurabilir ya da davet koduyla
          katılabilirsin.
        </p>
        <Link href="/groups">
          <button>Takımlarım</button>
        </Link>
      </Card>
    );
  }

  const upcoming = data?.upcomingMatches ?? [];
  const stats = data?.monthStats;
  const last = data?.lastMatch ?? null;

  return (
    <div>
      <div style={{ marginBottom: "var(--space-4)" }}>
        <TeamSwitcher />
      </div>

      <ErrorText>{error}</ErrorText>

      {/* Yaklasan maclar — birden fazla takimda mac varsa hepsi listelenir */}
      {upcoming.length > 0 ? (
        upcoming.map((match) => (
          <MatchTicket
            key={match.id}
            match={match}
            showTeam={isAll}
            busy={busyMatchId === match.id}
            onAttend={(status) => setAttendance(match, status)}
          />
        ))
      ) : (
        <Card>
          <Eyebrow>SIRADAKİ MAÇ</Eyebrow>
          <p className="muted" style={{ marginBottom: 0 }}>
            Planlanmış maç yok.
          </p>
        </Card>
      )}

      {/* BU AY */}
      {stats && (
        <>
          <Eyebrow>BU AY</Eyebrow>
          <div className="stats-grid" style={{ marginTop: 8 }}>
            <div className="stats-cell">
              <span className="stats-value">{stats.played}</span>
              <Eyebrow>MAÇ</Eyebrow>
              <span className="muted">
                {stats.wins}G · {stats.draws}B · {stats.losses}M
              </span>
            </div>
            <div className="stats-cell">
              <span className="stats-value" style={{ color: "var(--amber-700)" }}>
                {stats.streak}
              </span>
              <Eyebrow>GALİBİYET SERİSİ</Eyebrow>
              <div className="result-squares">
                {stats.recentResults.map((r, i) => (
                  <span key={i} className={`result-square ${r ?? ""}`} />
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* SON MAC */}
      {last && (
        <>
          <Eyebrow>
            SON MAÇ · {shortDate(last.scheduledAt)}
            {isAll ? ` · ${last.groupName}` : ""}
          </Eyebrow>
          <div className="last-match" style={{ marginTop: 8 }}>
            <div className="last-match-head">
              <div className="stack grow">
                {last.outcome === "win" && <Badge tone="accent">Kazandın</Badge>}
                {last.outcome === "loss" && <Badge tone="neutral">Kaybettin</Badge>}
                {last.outcome === "draw" && <Badge tone="neutral">Berabere</Badge>}
                {last.outcome === null && <Badge tone="neutral">Takım içi</Badge>}
                <span className="muted">{last.homeLabel ?? "Bizim takım"}</span>
              </div>
              {last.hasScore && (
                <div className="row" style={{ flexWrap: "nowrap" }}>
                  <span
                    className={`big-score ${last.outcome === "loss" ? "muted" : ""}`}
                  >
                    {last.homeScore}
                  </span>
                  <span className="big-score muted">–</span>
                  <span
                    className={`big-score ${last.outcome === "win" ? "muted" : ""}`}
                  >
                    {last.awayScore}
                  </span>
                </div>
              )}
            </div>

            {last.mvp && (
              <div className="mvp-row">
                <div className="stack grow">
                  <span>
                    <strong>{last.mvp.name}</strong>{" "}
                    <span className="mvp-tag">MVP</span>
                  </span>
                  <span className="muted">Maç ortalaması</span>
                </div>
                <ScoreBadge value={last.mvp.average} label="MAÇ" />
              </div>
            )}

            {last.ratingOpen && last.pendingRatings > 0 && (
              <Link
                href={`/group/${last.groupId}/match/${last.id}/rate`}
                className="link-row"
              >
                Maçı oyla · {last.pendingRatings} oyuncu kaldı
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Bilet duzenindeki mac karti. Her yaklasan mac icin bir kez cizilir; boylece
// ayni anda birden fazla takimda maci olan oyuncu hepsine yoklama verebilir.
function MatchTicket({
  match,
  showTeam,
  busy,
  onAttend,
}: {
  match: UpcomingMatch;
  showTeam: boolean;
  busy: boolean;
  onAttend: (status: "yes" | "no") => void;
}) {
  const capacity = match.requiredPlayers;
  const fillPct =
    capacity && capacity > 0
      ? Math.min(100, Math.round((match.attendingCount / capacity) * 100))
      : 0;

  return (
    <div className="ticket">
      <div className="ticket-head">
        <Eyebrow>{showTeam ? `SIRADAKİ · ${match.groupName}` : "SIRADAKİ MAÇ"}</Eyebrow>
        <Badge tone="brand">{countdownLabel(match.scheduledAt)}</Badge>
      </div>

      <div className="ticket-scores">
        <div className="ticket-cell">
          <span className="ticket-value">{dayNumber(match.scheduledAt)}</span>
          <Eyebrow>{monthAndDay(match.scheduledAt)}</Eyebrow>
        </div>
        <div className="ticket-cell">
          <span className="ticket-value">{clockTime(match.scheduledAt)}</span>
          <Eyebrow>BAŞLAMA</Eyebrow>
        </div>
        <div className="ticket-cell">
          <span className="ticket-value">
            {match.format ?? (match.matchKind === "ic" ? "İÇ" : "DIŞ")}
          </span>
          <Eyebrow>FORMAT</Eyebrow>
        </div>
      </div>

      {match.location && (
        <div className="ticket-location">
          <div style={{ fontWeight: 500 }}>{match.location}</div>
          <div className="muted">
            {match.matchKind === "ic" ? "Takım içi maç" : "Dış rakip"}
          </div>
        </div>
      )}

      <div className="ticket-squad">
        <div className="ticket-squad-head">
          <Eyebrow>KADRO</Eyebrow>
          <span>
            <strong style={{ fontFamily: "var(--font-display)" }}>
              {match.attendingCount}
              {capacity ? `/${capacity}` : ""}
            </strong>{" "}
            <Eyebrow>KATILIYOR</Eyebrow>
          </span>
        </div>

        {match.attendingNames.length > 0 && (
          <div className="muted">
            {match.attendingNames.join(", ")}
            {match.attendingCount > match.attendingNames.length
              ? ` +${match.attendingCount - match.attendingNames.length}`
              : ""}
          </div>
        )}

        {capacity && (
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${fillPct}%` }} />
          </div>
        )}
      </div>

      <div className="ticket-cta">
        {match.myAttendance === "yes" ? (
          <>
            <button className="secondary" disabled={busy} onClick={() => onAttend("no")}>
              ✓ Katılıyorsun · Vazgeç
            </button>
            <p className="cta-helper">Kadroda {match.attendingCount}. sıradasın.</p>
          </>
        ) : (
          <>
            <button disabled={busy} onClick={() => onAttend("yes")}>
              {match.myAttendance === "no" ? "Fikrimi değiştirdim" : "Katılıyorum"}
            </button>
            <p className="cta-helper">
              {match.myAttendance === "no"
                ? "Şu an katılmıyor görünüyorsun."
                : "Yoklama maç saatine kadar açık."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
