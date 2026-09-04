"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Card, ErrorText, Eyebrow } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";
import { shortDate } from "@/lib/dateFormat";

type FunnelStep = { label: string; count: number };
type Stats = {
  totals: {
    users: number;
    groups: number;
    matches: number;
    completedMatches: number;
    votes: number;
    matchRatings: number;
  };
  growth: { usersLast7: number; usersLast30: number; groupsLast30: number; matchesLast30: number };
  active: { users7: number; users30: number };
  funnel: FunnelStep[];
  health: {
    ratingCompletionPct: number | null;
    ratingParticipants: number;
    ratingPenalised: number;
    scoreEnteredPct: number | null;
    squadUsagePct: number | null;
    avgAttendanceResponses: number | null;
  };
  groups: { total: number; withMatch: number; withCompletedMatch: number; dead: number };
  topGroups: {
    id: string;
    name: string;
    members: number;
    matches: number;
    completed: number;
    lastActivity: string | null;
  }[];
  recentUsers: { id: string; name: string; email: string; created_at: string; groups: number }[];
  feedback: { open: number; total: number };
};

type Feedback = {
  id: string;
  kind: "sorun" | "oneri" | "diger";
  message: string;
  app: string | null;
  status: "yeni" | "okundu" | "kapandi";
  created_at: string;
  user_name: string | null;
  user_email: string | null;
  user_id: string | null;
  group_name: string | null;
};

const KIND_LABEL = { sorun: "Sorun", oneri: "Öneri", diger: "Diğer" } as const;
const STATUS_LABEL = { yeni: "Yeni", okundu: "Okundu", kapandi: "Kapandı" } as const;

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, f] = await Promise.all([
        api.get<{ stats: Stats }>("/api/admin/stats"),
        api.get<{ feedback: Feedback[] }>("/api/admin/feedback"),
      ]);
      setStats(s.stats);
      setFeedback(f.feedback);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setDenied(true);
      else setError(err instanceof ApiError ? err.message : "Yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(id: string, status: Feedback["status"]) {
    setBusy(true);
    try {
      await api.patch("/api/admin/feedback", { id, status });
      setFeedback((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Güncellenemedi.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Yükleniyor...</p>;

  if (denied) {
    return (
      <div>
        <h1>Bulunamadı</h1>
        <p className="muted">Bu sayfaya erişimin yok.</p>
        <p>
          <Link className="back-link" href="/home">← Ana sayfa</Link>
        </p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div>
        <ErrorText>{error}</ErrorText>
        <p>
          <Link className="back-link" href="/home">← Ana sayfa</Link>
        </p>
      </div>
    );
  }

  const firstStep = stats.funnel[0]?.count || 1;

  return (
    <div>
      <p>
        <Link className="back-link" href="/home">← Ana sayfa</Link>
      </p>
      <h1>Yönetim Paneli</h1>
      <p className="muted" style={{ marginTop: 4 }}>
        Platformun geneli. Tüm sayılar topludur; kimin kime kaç puan verdiği gibi
        kişisel veriler burada gösterilmez.
      </p>

      <ErrorText>{error}</ErrorText>

      {/* ---- Temel sayilar ---- */}
      <Card raised>
        <Eyebrow>GENEL</Eyebrow>
        <div className="admin-grid" style={{ marginTop: 12 }}>
          <Metric label="KULLANICI" value={stats.totals.users} sub={`+${stats.growth.usersLast7} bu hafta`} />
          <Metric label="TAKIM" value={stats.totals.groups} sub={`+${stats.growth.groupsLast30} bu ay`} />
          <Metric label="MAÇ" value={stats.totals.matches} sub={`+${stats.growth.matchesLast30} bu ay`} />
          <Metric label="TAMAMLANAN" value={stats.totals.completedMatches} />
          <Metric label="VERİLEN OY" value={stats.totals.votes} />
          <Metric label="MAÇ PUANI" value={stats.totals.matchRatings} />
        </div>
      </Card>

      {/* ---- Gercekten kullaniyorlar mi ---- */}
      <Card>
        <Eyebrow>AKTİF KULLANICI</Eyebrow>
        <p className="muted" style={{ margin: "6px 0 12px", fontSize: "var(--text-caption)" }}>
          Sadece giriş yapmak değil; oy vermiş, maç puanlamış, yoklama bildirmiş
          ya da maç oluşturmuş olmak sayılır.
        </p>
        <div className="admin-grid">
          <Metric
            label="SON 7 GÜN"
            value={stats.active.users7}
            sub={`toplamın %${Math.round((stats.active.users7 / (stats.totals.users || 1)) * 100)}'i`}
          />
          <Metric
            label="SON 30 GÜN"
            value={stats.active.users30}
            sub={`toplamın %${Math.round((stats.active.users30 / (stats.totals.users || 1)) * 100)}'i`}
          />
        </div>
      </Card>

      {/* ---- Huni: nerede dusuyorlar ---- */}
      <Card>
        <Eyebrow>KULLANIM HUNİSİ</Eyebrow>
        <p className="muted" style={{ margin: "6px 0 12px", fontSize: "var(--text-caption)" }}>
          Kayıttan çekirdek döngünün sonuna kadar kaç kişi ilerliyor. En büyük
          düşüşün olduğu adım, üzerinde çalışılacak yerdir.
        </p>
        <div className="funnel">
          {stats.funnel.map((step, i) => {
            const prev = i === 0 ? step.count : stats.funnel[i - 1].count;
            const dropPct = prev > 0 ? Math.round(((prev - step.count) / prev) * 100) : 0;
            const widthPct = Math.max(4, (step.count / firstStep) * 100);
            return (
              <div key={step.label} className="funnel-step">
                <div className="funnel-label">
                  <span>{step.label}</span>
                  <span className="funnel-count">{step.count}</span>
                </div>
                <div className="funnel-track">
                  <div className="funnel-bar" style={{ width: `${widthPct}%` }} />
                </div>
                {i > 0 && dropPct > 0 && (
                  <div className="funnel-drop">bir önceki adımdan %{dropPct} düşüş</div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ---- Cekirdek dongu sagligi ---- */}
      <Card>
        <Eyebrow>ÇEKİRDEK DÖNGÜ</Eyebrow>
        <div className="admin-grid" style={{ marginTop: 12 }}>
          <Metric
            label="PUANLAMA TAMAMLAMA"
            value={stats.health.ratingCompletionPct != null ? `%${stats.health.ratingCompletionPct}` : "—"}
            sub={
              stats.health.ratingParticipants > 0
                ? `${stats.health.ratingPenalised}/${stats.health.ratingParticipants} ceza yedi`
                : "henüz veri yok"
            }
            tone={
              stats.health.ratingCompletionPct == null
                ? "neutral"
                : stats.health.ratingCompletionPct >= 70
                ? "good"
                : "bad"
            }
          />
          <Metric
            label="SKOR GİRİLME"
            value={stats.health.scoreEnteredPct != null ? `%${stats.health.scoreEnteredPct}` : "—"}
            sub="tamamlanan maçlarda"
            tone={
              stats.health.scoreEnteredPct == null
                ? "neutral"
                : stats.health.scoreEnteredPct >= 60
                ? "good"
                : "bad"
            }
          />
          <Metric
            label="KADRO KULLANIMI"
            value={stats.health.squadUsagePct != null ? `%${stats.health.squadUsagePct}` : "—"}
            sub="takım içi maçlarda"
          />
          <Metric
            label="ORT. YOKLAMA"
            value={stats.health.avgAttendanceResponses ?? "—"}
            sub="maç başına cevap"
          />
        </div>
      </Card>

      {/* ---- Takimlar ---- */}
      <Card>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <Eyebrow>TAKIMLAR</Eyebrow>
          <span className="muted" style={{ fontSize: "var(--text-caption)" }}>
            {stats.groups.dead} takım hiç maç yapmamış
          </span>
        </div>
        <div className="admin-grid" style={{ marginTop: 12, marginBottom: 16 }}>
          <Metric label="TOPLAM" value={stats.groups.total} />
          <Metric label="MAÇI OLAN" value={stats.groups.withMatch} />
          <Metric label="MAÇ OYNAMIŞ" value={stats.groups.withCompletedMatch} />
        </div>

        <div className="roster">
          {stats.topGroups.map((g) => (
            <div key={g.id} className="roster-row">
              <span className="grow">
                <span className="roster-name">{g.name}</span>
                <div className="roster-meta">
                  {g.members} üye · {g.matches} maç ({g.completed} tamamlandı)
                  {g.lastActivity ? ` · son: ${shortDate(g.lastActivity)}` : " · hiç maç yok"}
                </div>
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* ---- Geri bildirim ---- */}
      <div className="section-head">
        <h2>Geri bildirim</h2>
        <span className="muted" style={{ fontSize: "var(--text-caption)" }}>
          {stats.feedback.open} yeni / {stats.feedback.total} toplam
        </span>
      </div>

      {feedback.length === 0 ? (
        <Card>
          <p className="muted" style={{ margin: 0 }}>
            Henüz geri bildirim yok. Kullanıcılar Profil sekmesindeki
            &quot;Geri bildirim gönder&quot; ile yazabilir.
          </p>
        </Card>
      ) : (
        <div className="section-body">
          {feedback.map((f) => (
            <Card key={f.id} className={f.status === "yeni" ? "needs-action" : ""}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="row" style={{ gap: 6 }}>
                  <Badge tone={f.kind === "sorun" ? "danger" : f.kind === "oneri" ? "brand" : "neutral"}>
                    {KIND_LABEL[f.kind]}
                  </Badge>
                  {f.status === "yeni" && <Badge tone="accent">{STATUS_LABEL[f.status]}</Badge>}
                  {f.status !== "yeni" && <Badge tone="neutral">{STATUS_LABEL[f.status]}</Badge>}
                </div>
                <span className="muted" style={{ fontSize: "var(--text-caption)" }}>
                  {shortDate(f.created_at)} · {f.app ?? "—"}
                </span>
              </div>

              <p style={{ margin: "10px 0 0", whiteSpace: "pre-wrap" }}>{f.message}</p>

              <p className="muted" style={{ margin: "10px 0 0", fontSize: "var(--text-caption)" }}>
                {f.user_name ?? "Silinmiş kullanıcı"}
                {f.user_email ? ` · ${f.user_email}` : ""}
                {f.group_name ? ` · ${f.group_name}` : ""}
                {!f.user_id && " · hesap silinmiş"}
              </p>

              <div className="row" style={{ marginTop: 12 }}>
                {f.status !== "okundu" && (
                  <button className="secondary small" disabled={busy} onClick={() => setStatus(f.id, "okundu")}>
                    Okundu
                  </button>
                )}
                {f.status !== "kapandi" && (
                  <button className="secondary small" disabled={busy} onClick={() => setStatus(f.id, "kapandi")}>
                    Kapat
                  </button>
                )}
                {f.status !== "yeni" && (
                  <button className="secondary small" disabled={busy} onClick={() => setStatus(f.id, "yeni")}>
                    Yeniye al
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ---- Son kayitlar ---- */}
      <div className="section-head">
        <h2>Son kayıtlar</h2>
      </div>
      <Card>
        <div className="roster">
          {stats.recentUsers.map((u) => (
            <div key={u.id} className="roster-row">
              <span className="grow">
                <span className="roster-name">{u.name}</span>
                <div className="roster-meta">
                  {u.email} · {shortDate(u.created_at)}
                </div>
              </span>
              <span className="roster-score">
                {u.groups > 0 ? `${u.groups} takım` : "takımsız"}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "neutral" | "good" | "bad";
}) {
  return (
    <div className="admin-metric">
      <div
        className="admin-metric-value"
        style={{
          color:
            tone === "good" ? "var(--pitch)" : tone === "bad" ? "var(--brick)" : undefined,
        }}
      >
        {value}
      </div>
      <div className="eyebrow">{label}</div>
      {sub && <div className="admin-metric-sub">{sub}</div>}
    </div>
  );
}
