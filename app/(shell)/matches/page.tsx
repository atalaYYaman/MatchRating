"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, BadgeTone, Card, ErrorText, PageHeader } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";
import { useActiveGroup } from "@/lib/active-group";
import { clockTime, countdownLabel, shortDate } from "@/lib/dateFormat";

type MatchRow = {
  id: string;
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
  const { activeGroup } = useActiveGroup();

  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeGroup) {
      setMatches([]);
      setLoading(false);
      return;
    }
    try {
      const data = await api.get<{ matches: MatchRow[] }>(
        `/api/groups/${activeGroup.id}/matches`
      );
      setMatches(data.matches);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Maçlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [activeGroup]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        eyebrow={activeGroup?.name ?? "TAKIM SEÇİLMEDİ"}
        title="Maçlar"
        action={
          activeGroup ? (
            <Link href={`/group/${activeGroup.id}/match/new`}>
              <button className="small">Yeni maç</button>
            </Link>
          ) : null
        }
      />

      <ErrorText>{error}</ErrorText>

      {loading && <p className="muted">Yükleniyor...</p>}

      {!loading && matches.length === 0 && (
        <Card>
          <p className="muted" style={{ margin: 0 }}>
            {activeGroup
              ? "Bu takımda henüz maç yok."
              : "Önce Takımlarım sekmesinden bir takım seç."}
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
            href={`/group/${activeGroup?.id}/match/${m.id}`}
            style={{ display: "block", color: "inherit" }}
          >
            <Card>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <Badge tone={status.tone}>{status.label}</Badge>
                <span className="muted">
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
