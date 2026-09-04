"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, BadgeTone, Card, ErrorText } from "@/components/ui";
import { TeamSwitcher } from "@/components/TeamSwitcher";
import { api, ApiError } from "@/lib/client-api";
import { useActiveGroup } from "@/lib/active-group";
import { clockTime, countdownLabel, shortDate } from "@/lib/dateFormat";
import { MatchPhase } from "@/lib/matchStatus";
import { PhaseBadge } from "@/components/PhaseBadge";

type MatchRow = {
  id: string;
  group_id: string;
  group_name: string;
  isOwner: boolean;
  mode: "poll" | "fixed";
  match_kind: "ic" | "dis";
  scheduled_at: string | null;
  location: string | null;
  status: "poll_open" | "scheduled" | "completed" | "cancelled";
  phase: MatchPhase;
  attending_count: number;
  poll_response_count: number;
  /** Senden bekleneni anlatir; amber sinyalin kaynagi. */
  myAction: "poll" | "rsvp" | "rating" | null;
};

const ACTION_LABEL: Record<"poll" | "rsvp" | "rating", string> = {
  poll: "Anketi cevapla",
  rsvp: "Katılım bildir",
  rating: "Maçı puanla",
};

// Dort cip yeter: hepsi, senden bir sey beklenenler, gelecek, gecmis.
const FILTERS = [
  { key: "all", label: "Tümü", phases: null },
  { key: "rating", label: "Puanlanıyor", phases: ["rating"] },
  { key: "upcoming", label: "Yaklaşan", phases: ["poll", "scheduled", "playing"] },
  { key: "past", label: "Tamamlandı", phases: ["completed", "cancelled"] },
] as const;

export default function MatchesPage() {
  const { activeGroup, isAll, scopeId, groups } = useActiveGroup();

  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  // Kapsam degistiginde onceki istek hala ucuyor olabilir; gec donen eski
  // yanit yenisini ezmesin diye istegin kapsami ile guncel kapsam karsilastirilir.
  const scopeRef = useRef(scopeId);
  scopeRef.current = scopeId;

  const load = useCallback(async () => {
    const requested = scopeId;
    try {
      const query = requested ? `?groupId=${requested}` : "";
      const data = await api.get<{ matches: MatchRow[] }>(`/api/matches${query}`);
      if (scopeRef.current !== requested) return;
      setMatches(data.matches);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Maçlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

  useEffect(() => {
    load();
  }, [load]);

  // "Tüm takımlar" gorunumunde hedef belirsiz: yalnizca tek takimin
  // yoneticisiysen dogrudan oraya, degilse buton gizlenir.
  const newMatchTarget = activeGroup ?? (groups.length === 1 ? groups[0] : null);
  const newMatchHref = newMatchTarget
    ? `/group/${newMatchTarget.id}/match/new`
    : null;

  const activeFilter = FILTERS.find((f) => f.key === filter);
  const visible = activeFilter?.phases
    ? matches.filter((m) => (activeFilter.phases as readonly string[]).includes(m.phase))
    : matches;

  return (
    <div>
      <div className="page-header">
        <div className="grow">
          <TeamSwitcher eyebrow="MAÇLAR · TAKIM" />
        </div>
        {newMatchHref && (
          <Link href={newMatchHref}>
            <button className="small">Yeni maç</button>
          </Link>
        )}
      </div>

      <ErrorText>{error}</ErrorText>

      <div className="chips" style={{ marginBottom: "var(--space-4)" }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`chip ${filter === f.key ? "chip-on" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <p className="muted">Yükleniyor...</p>}

      {!loading && visible.length === 0 && (
        <Card>
          <p className="muted" style={{ margin: 0 }}>
            {isAll
              ? "Takımlarının hiçbirinde henüz maç yok."
              : "Bu takımda henüz maç yok."}
          </p>
        </Card>
      )}

      {visible.map((m) => {
        const upcoming =
          m.scheduled_at && new Date(m.scheduled_at).getTime() > Date.now();
        return (
          <Link
            key={m.id}
            href={`/group/${m.group_id}/match/${m.id}`}
            style={{ display: "block", color: "inherit" }}
          >
            <Card className={m.myAction ? "needs-action" : ""}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="row" style={{ gap: 6 }}>
                  <PhaseBadge phase={m.phase} />
                  {m.myAction && (
                    <Badge tone="accent">{ACTION_LABEL[m.myAction]}</Badge>
                  )}
                </div>
                <span className="muted">
                  {isAll ? `${m.group_name} · ` : ""}
                  {m.match_kind === "ic" ? "Takım içi" : "Dış rakip"}
                </span>
              </div>

              <h2 style={{ margin: "10px 0 2px" }}>
                {m.scheduled_at
                  ? `${shortDate(m.scheduled_at)} · ${clockTime(m.scheduled_at)}`
                  : "Tarih anketi sürüyor"}
              </h2>
              {m.location && <div className="muted">{m.location}</div>}

              <div
                className="row"
                style={{
                  justifyContent: "space-between",
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: "1px solid var(--border-default)",
                }}
              >
                <span className="muted">
                  {m.status === "poll_open"
                    ? `${m.poll_response_count} cevap`
                    : `${m.attending_count} katılıyor`}
                </span>
                {upcoming && m.scheduled_at && (
                  <span style={{ color: "var(--text-link)", fontSize: "var(--text-caption)", fontWeight: 500 }}>
                    {countdownLabel(m.scheduled_at)}
                  </span>
                )}
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
