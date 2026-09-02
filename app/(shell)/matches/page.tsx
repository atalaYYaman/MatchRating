"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, BadgeTone, Card, ErrorText } from "@/components/ui";
import { TeamSwitcher } from "@/components/TeamSwitcher";
import { api, ApiError } from "@/lib/client-api";
import { useActiveGroup } from "@/lib/active-group";
import { clockTime, countdownLabel, shortDate } from "@/lib/dateFormat";

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
  attending_count: number;
  poll_response_count: number;
};

const STATUS: Record<MatchRow["status"], { label: string; tone: BadgeTone }> = {
  poll_open: { label: "Anket açık", tone: "accent" },
  scheduled: { label: "Planlandı", tone: "brand" },
  completed: { label: "Tamamlandı", tone: "neutral" },
  cancelled: { label: "İptal", tone: "danger" },
};

export default function MatchesPage() {
  const { activeGroup, isAll, scopeId, groups } = useActiveGroup();

  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      {loading && <p className="muted">Yükleniyor...</p>}

      {!loading && matches.length === 0 && (
        <Card>
          <p className="muted" style={{ margin: 0 }}>
            {isAll
              ? "Takımlarının hiçbirinde henüz maç yok."
              : "Bu takımda henüz maç yok."}
          </p>
        </Card>
      )}

      {matches.map((m) => {
        const status = STATUS[m.status];
        const upcoming =
          m.scheduled_at && new Date(m.scheduled_at).getTime() > Date.now();
        return (
          <Link
            key={m.id}
            href={`/group/${m.group_id}/match/${m.id}`}
            style={{ display: "block", color: "inherit" }}
          >
            <Card>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <Badge tone={status.tone}>{status.label}</Badge>
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
                  <span style={{ color: "var(--text-link)", fontSize: 13, fontWeight: 500 }}>
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
