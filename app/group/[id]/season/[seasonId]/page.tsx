"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge, Card, ErrorText, Eyebrow, ScoreBadge } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";
import { shortDate } from "@/lib/dateFormat";

type Summary = {
  standings: { userId: string; name: string; overall: number }[];
  records: {
    userId: string;
    name: string;
    played: number;
    wins: number;
    draws: number;
    losses: number;
  }[];
  mvp: { userId: string; name: string; wins: number } | null;
  matchCount: number;
};
type Season = {
  id: string;
  name: string;
  status: "active" | "closed";
  created_at: string;
  closed_at: string | null;
};

export default function SeasonSummaryPage() {
  const params = useParams<{ id: string; seasonId: string }>();
  const { id: groupId, seasonId } = params;

  const [season, setSeason] = useState<Season | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ season: Season; summary: Summary; live: boolean }>(
        `/api/groups/${groupId}/seasons/${seasonId}`
      );
      setSeason(data.season);
      setSummary(data.summary);
      setLive(data.live);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sezon yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [groupId, seasonId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="muted">Yükleniyor...</p>;
  if (!season || !summary) {
    return (
      <div>
        <p>
          <Link className="back-link" href={`/group/${groupId}/seasons`}>← Sezonlar</Link>
        </p>
        <ErrorText>{error}</ErrorText>
      </div>
    );
  }

  const rankedRecords = [...summary.records].sort(
    (a, b) => b.wins - a.wins || b.played - a.played
  );

  return (
    <div>
      <p>
        <Link className="back-link" href={`/group/${groupId}/seasons`}>← Sezonlar</Link>
      </p>

      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>{season.name}</h1>
        <Badge tone={season.status === "active" ? "brand" : "neutral"}>
          {season.status === "active" ? "Aktif" : "Kapandı"}
        </Badge>
      </div>
      <p className="muted" style={{ marginTop: 4 }}>
        {season.status === "closed" && season.closed_at
          ? `${shortDate(season.created_at)} – ${shortDate(season.closed_at)}`
          : `${shortDate(season.created_at)} – devam ediyor`}{" "}
        · {summary.matchCount} tamamlanan maç
      </p>

      {live && (
        <p className="muted" style={{ fontSize: 13 }}>
          Bu sezon devam ediyor; aşağıdaki özet o ana kadarki duruma göre canlı
          hesaplanır.
        </p>
      )}

      <ErrorText>{error}</ErrorText>

      {summary.mvp && (
        <Card raised>
          <Eyebrow>SEZONUN OYUNCUSU</Eyebrow>
          <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
            <strong style={{ fontSize: 18 }}>{summary.mvp.name}</strong>
            <ScoreBadge value={summary.mvp.wins} label="GALİBİYET" />
          </div>
        </Card>
      )}

      <Eyebrow>GALİBİYET KAYDI</Eyebrow>
      <Card style={{ marginTop: 8, overflowX: "auto" }}>
        {rankedRecords.filter((r) => r.played > 0).length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Bu sezonda skorlanmış maç yok.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>İsim</th>
                <th>O</th>
                <th>G</th>
                <th>B</th>
                <th>M</th>
              </tr>
            </thead>
            <tbody>
              {rankedRecords
                .filter((r) => r.played > 0)
                .map((r) => (
                  <tr key={r.userId}>
                    <td>{r.name}</td>
                    <td>{r.played}</td>
                    <td>{r.wins}</td>
                    <td>{r.draws}</td>
                    <td>{r.losses}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </Card>

      <Eyebrow>GÜÇ SIRALAMASI</Eyebrow>
      <Card style={{ marginTop: 8, overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>İsim</th>
              <th>Genel</th>
            </tr>
          </thead>
          <tbody>
            {summary.standings.map((s) => (
              <tr key={s.userId}>
                <td>{s.name}</td>
                <td>
                  <strong>{s.overall}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
