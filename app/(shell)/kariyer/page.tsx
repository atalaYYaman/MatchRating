"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Card, ErrorText, Eyebrow, ScoreBadge } from "@/components/ui";
import { TeamSwitcher } from "@/components/TeamSwitcher";
import { api, ApiError } from "@/lib/client-api";
import { useActiveGroup } from "@/lib/active-group";
import { shortDate } from "@/lib/dateFormat";
import { SKILLS } from "@/lib/skills";

type RatingPoint = { matchId: string | null; at: string; overall: number; delta: number };
type TimelineEntry = {
  matchId: string;
  groupId: string;
  groupName: string;
  at: string;
  netDelta: number;
  performanceDelta: number;
  penaltyDelta: number;
  matchAverage: number | null;
};
type SkillJourney = { skill: string; start: number; current: number; delta: number };
type GroupJourney = {
  groupId: string;
  groupName: string;
  startOverall: number;
  currentOverall: number;
  netDelta: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: RatingPoint[];
  skills: SkillJourney[];
};
type Companion = { key: string; name: string; isGuest: boolean; count: number };
type Career = {
  groups: GroupJourney[];
  timeline: TimelineEntry[];
  totals: { played: number; wins: number; draws: number; losses: number };
  matchRatings: { count: number; average: number | null; best: number | null };
  strengths: { skill: string; count: number }[];
  weaknesses: { skill: string; count: number }[];
  wonWith: Companion[];
  lostTo: Companion[];
  bestMatch: TimelineEntry | null;
  worstMatch: TimelineEntry | null;
};

function skillLabel(key: string) {
  return SKILLS.find((s) => s.key === key)?.label ?? key;
}

function signed(value: number) {
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}

export default function CareerPage() {
  const { scopeId, isAll } = useActiveGroup();
  const [career, setCareer] = useState<Career | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Kapsam degisince eski istegin gec gelen cevabi yeniyi ezmesin.
  const scopeRef = useRef<string | null>(scopeId);

  const load = useCallback(async () => {
    const requested = scopeId;
    scopeRef.current = requested;
    setLoading(true);
    try {
      const query = requested ? `?groupId=${requested}` : "";
      const data = await api.get<{ career: Career }>(`/api/career${query}`);
      if (scopeRef.current !== requested) return;
      setCareer(data.career);
      setError(null);
    } catch (err) {
      if (scopeRef.current !== requested) return;
      setError(err instanceof ApiError ? err.message : "Kariyer yüklenemedi.");
    } finally {
      if (scopeRef.current === requested) setLoading(false);
    }
  }, [scopeId]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = career?.totals;
  const winRate =
    totals && totals.played > 0
      ? Math.round((totals.wins / totals.played) * 100)
      : null;

  return (
    <div>
      <TeamSwitcher eyebrow="KARİYER · TAKIM" />
      <h1>Kariyerim</h1>
      <p className="muted" style={{ marginTop: 4 }}>
        {isAll
          ? "Tüm takımlarındaki gelişimin, maç puanların ve birlikte oynadığın kişiler."
          : "Bu takımdaki gelişimin, maç puanların ve birlikte oynadığın kişiler."}
      </p>

      <ErrorText>{error}</ErrorText>
      {loading && <p className="muted">Yükleniyor...</p>}

      {career && !loading && (
        <>
          {/* Ozet rakamlar */}
          <Card raised>
            <Eyebrow>ÖZET</Eyebrow>
            <div className="stat-row" style={{ marginTop: 12 }}>
              <Stat label="MAÇ" value={totals?.played ?? 0} />
              <Stat
                label="G-B-M"
                value={`${totals?.wins ?? 0}-${totals?.draws ?? 0}-${totals?.losses ?? 0}`}
              />
              {winRate !== null && <Stat label="KAZANMA" value={`%${winRate}`} />}
            </div>
            {career.matchRatings.count > 0 && (
              <div className="stat-row" style={{ marginTop: 16 }}>
                <Stat label="ORT. MAÇ PUANI" value={career.matchRatings.average ?? "—"} />
                <Stat label="EN İYİ MAÇIN" value={career.matchRatings.best ?? "—"} />
                <Stat label="ALDIĞIN OY" value={career.matchRatings.count} />
              </div>
            )}
          </Card>

          {career.totals.played === 0 && career.timeline.length === 0 && (
            <Card>
              <p className="muted" style={{ margin: 0 }}>
                Henüz puanlanmış bir maçın yok. İlk maçından sonra kariyer özetin
                burada oluşmaya başlayacak.
              </p>
            </Card>
          )}

          {/* Takim bazinda puan yolculugu */}
          {career.groups.map((g) => (
            <Card key={g.groupId}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{g.groupName}</strong>
                <Badge tone={g.netDelta > 0 ? "brand" : g.netDelta < 0 ? "danger" : "neutral"}>
                  {signed(g.netDelta)}
                </Badge>
              </div>

              <div
                className="row"
                style={{ justifyContent: "space-between", alignItems: "center", marginTop: 14 }}
              >
                <div style={{ textAlign: "center" }}>
                  <div className="eyebrow">BAŞLANGIÇ</div>
                  <div className="big-score muted" style={{ fontSize: "var(--text-title)" }}>
                    {g.startOverall}
                  </div>
                </div>
                <div className="muted" style={{ fontSize: "var(--text-heading)" }}>→</div>
                <div style={{ textAlign: "center" }}>
                  <div className="eyebrow">ŞİMDİ</div>
                  <div className="big-score" style={{ fontSize: "var(--text-title)" }}>
                    {g.currentOverall}
                  </div>
                </div>
                <ScoreBadge value={`${g.wins}-${g.draws}-${g.losses}`} label="G-B-M" />
              </div>

              {g.points.length > 1 && <Sparkline points={g.points} />}

              {g.skills.length > 0 && (
                <div style={{ marginTop: 18, overflowX: "auto" }}>
                  <Eyebrow>YETENEK KIRILIMI</Eyebrow>
                  <table style={{ marginTop: 8 }}>
                    <thead>
                      <tr>
                        <th>Yetenek</th>
                        <th>Başlangıç</th>
                        <th>Şimdi</th>
                        <th>Fark</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.skills.map((sk) => (
                        <tr key={sk.skill}>
                          <td>{skillLabel(sk.skill)}</td>
                          <td className="muted">{sk.start}</td>
                          <td>
                            <strong>{sk.current}</strong>
                          </td>
                          <td
                            style={{
                              color:
                                sk.delta > 0
                                  ? "var(--pitch)"
                                  : sk.delta < 0
                                  ? "var(--brick)"
                                  : "var(--ink-300)",
                              fontWeight: sk.delta !== 0 ? 600 : 400,
                            }}
                          >
                            {sk.delta === 0 ? "—" : signed(sk.delta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ))}

          {/* Spotify Wrapped tarzi vurgular */}
          {(career.wonWith.length > 0 ||
            career.lostTo.length > 0 ||
            career.strengths.length > 0) && <Eyebrow>ÖNE ÇIKANLAR</Eyebrow>}

          {career.strengths.length > 0 && (
            <Card style={{ marginTop: 8 }}>
              <p className="muted" style={{ margin: 0, fontSize: "var(--text-caption)" }}>
                Takım arkadaşların seni en çok bu yönünle övdü
              </p>
              <h2 style={{ margin: "6px 0 0" }}>
                {skillLabel(career.strengths[0].skill)}
              </h2>
              <p className="muted" style={{ margin: "2px 0 0" }}>
                {career.strengths[0].count} maçta öne çıkan yönün seçildi
              </p>
              {career.weaknesses.length > 0 && (
                <p className="muted" style={{ margin: "12px 0 0", fontSize: "var(--text-caption)" }}>
                  En çok geliştirmen istenen yön:{" "}
                  <strong>{skillLabel(career.weaknesses[0].skill)}</strong> (
                  {career.weaknesses[0].count} maç)
                </p>
              )}
            </Card>
          )}

          {career.wonWith.length > 0 && (
            <Card>
              <Eyebrow>UĞURLU TAKIM ARKADAŞLARIN</Eyebrow>
              <p className="muted" style={{ margin: "6px 0 10px", fontSize: "var(--text-caption)" }}>
                Aynı takımda oynayıp en çok birlikte kazandığın kişiler.
              </p>
              <div className="roster">
                {career.wonWith.map((c) => (
                  <div key={c.key} className="roster-row">
                    <span className="grow">
                      <span className="roster-name">{c.name}</span>
                      {c.isGuest && (
                        <span className="pill" style={{ marginLeft: 6 }}>misafir</span>
                      )}
                    </span>
                    <span className="roster-score">{c.count} galibiyet</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {career.lostTo.length > 0 && (
            <Card>
              <Eyebrow>KARŞINDA ZORLANDIKLARIN</Eyebrow>
              <p className="muted" style={{ margin: "6px 0 10px", fontSize: "var(--text-caption)" }}>
                Karşı takımdayken en çok kaybettiğin kişiler.
              </p>
              <div className="roster">
                {career.lostTo.map((c) => (
                  <div key={c.key} className="roster-row">
                    <span className="grow">
                      <span className="roster-name">{c.name}</span>
                      {c.isGuest && (
                        <span className="pill" style={{ marginLeft: 6 }}>misafir</span>
                      )}
                    </span>
                    <span className="roster-score">{c.count} mağlubiyet</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Zaman seridi */}
          {career.timeline.length > 0 && (
            <>
              <Eyebrow>PUAN ZAMAN ŞERİDİ</Eyebrow>
              <Card style={{ marginTop: 8 }}>
                <p className="muted" style={{ margin: "0 0 12px", fontSize: "var(--text-caption)" }}>
                  Her maç sonu puanlamasının yetenek puanlarına toplam etkisi.
                </p>
                <div className="timeline">
                  {career.timeline.map((t) => (
                    <div key={`${t.groupId}-${t.matchId}`} className="timeline-row">
                      <span
                        className="timeline-dot"
                        style={{
                          background:
                            t.netDelta > 0
                              ? "var(--pitch)"
                              : t.netDelta < 0
                              ? "var(--brick)"
                              : "var(--ink-300)",
                        }}
                      />
                      <span className="grow">
                        <span className="roster-name">{shortDate(t.at)}</span>
                        <div className="roster-meta">
                          {isAll ? `${t.groupName} · ` : ""}
                          {t.matchAverage != null ? `maç puanın ${t.matchAverage}` : "puan yok"}
                          {t.penaltyDelta < 0 ? " · puanlama cezası" : ""}
                        </div>
                      </span>
                      <span
                        className="roster-score"
                        style={{
                          color:
                            t.netDelta > 0
                              ? "var(--pitch)"
                              : t.netDelta < 0
                              ? "var(--brick)"
                              : undefined,
                        }}
                      >
                        {signed(t.netDelta)}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div className="big-score" style={{ fontSize: "var(--text-heading)" }}>{value}</div>
      <div className="eyebrow">{label}</div>
    </div>
  );
}

// Kucuk, kutuphanesiz gelisim grafigi: puan yolculugunu tek bakista gosterir.
function Sparkline({ points }: { points: RatingPoint[] }) {
  const values = points.map((p) => p.overall);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 100;
  const h = 32;

  const d = points
    .map((p, i) => {
      const x = (i / Math.max(1, points.length - 1)) * w;
      const y = h - ((p.overall - min) / span) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const rising = values[values.length - 1] >= values[0];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height: 40, marginTop: 14, display: "block" }}
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke={rising ? "var(--pitch)" : "var(--brick)"}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
