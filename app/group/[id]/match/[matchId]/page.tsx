"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge, Card, ErrorText, Eyebrow, Field, InlineMessage } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";
import { clockTime, countdownLabel, shortDate } from "@/lib/dateFormat";
import { MatchPhase } from "@/lib/matchStatus";
import { PhaseBadge } from "@/components/PhaseBadge";

type Detail = {
  match: {
    id: string;
    mode: "poll" | "fixed";
    match_kind: "ic" | "dis";
    required_players: number | null;
    note: string | null;
    scheduled_at: string | null;
    location: string | null;
    status: "poll_open" | "scheduled" | "completed" | "cancelled";
    home_score: number | null;
    away_score: number | null;
    home_label: string | null;
    away_label: string | null;
    poll_closes_at: string | null;
  };
  isOwner: boolean;
  phase: MatchPhase;
  options: { id: string; startsAt: string; location: string; voteCount: number }[];
  myPollResponse: { available: boolean } | null;
  myOptionIds: string[];
  attendance: { user_id: string; status: "yes" | "no"; name: string }[];
  myAttendance: "yes" | "no" | null;
  rating: {
    open: boolean;
    played: boolean;
    participants: { id: string; name: string }[];
    results: { userId: string; name: string; average: number; raterCount: number }[];
  };
  squads: {
    locked: boolean;
    home: { id: string; name: string; isGuest: boolean; overall: number }[];
    away: { id: string; name: string; isGuest: boolean; overall: number }[];
  } | null;
  pollExpired: boolean;
  rsvpClosesAt: string | null;
};

export default function MatchDetailPage() {
  const params = useParams<{ id: string; matchId: string }>();
  const router = useRouter();
  const { id: groupId, matchId } = params;

  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.get<Detail>(`/api/groups/${groupId}/matches/${matchId}`);
      setData(res);
      setPicked(new Set(res.myOptionIds));
      if (res.match.home_score != null) setHomeScore(String(res.match.home_score));
      if (res.match.away_score != null) setAwayScore(String(res.match.away_score));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Maç yüklenemedi.");
    }
  }, [groupId, matchId]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(fn: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  async function cancelMatch() {
    if (
      !confirm(
        "Maç iptal edilecek. Yoklama ve anket cevapları kaybolmaz ama maç kapanır. Emin misin?"
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/api/groups/${groupId}/matches/${matchId}`);
      router.push("/matches");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Maç iptal edilemedi.");
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div>
        <p>
          <Link className="back-link" href="/matches">← Maçlar</Link>
        </p>
        <ErrorText>{error}</ErrorText>
        {!error && <p className="muted">Yükleniyor...</p>}
      </div>
    );
  }

  const m = data.match;
  const isPoll = m.status === "poll_open";
  const attendees = data.attendance.filter((a) => a.status === "yes");
  const rsvpOpen =
    m.status === "scheduled" &&
    !!m.scheduled_at &&
    new Date(m.scheduled_at).getTime() > Date.now();

  return (
    <div>
      <p>
        <Link className="back-link" href="/matches">← Maçlar</Link>
      </p>

      <ErrorText>{error}</ErrorText>

      <Card raised>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <PhaseBadge phase={data.phase} />
          <span className="muted">
            {m.match_kind === "ic" ? "Takım içi" : "Dış rakip"}
          </span>
        </div>

        <h1 style={{ margin: "10px 0 2px" }}>
          {m.scheduled_at
            ? `${shortDate(m.scheduled_at)} · ${clockTime(m.scheduled_at)}`
            : "Tarih anketi sürüyor"}
        </h1>
        {m.location && <div className="muted">{m.location}</div>}
        {m.scheduled_at && new Date(m.scheduled_at).getTime() > Date.now() && (
          <div style={{ color: "var(--text-link)", fontSize: "var(--text-caption)", fontWeight: 500 }}>
            {countdownLabel(m.scheduled_at)}
          </div>
        )}
        {m.note && <p className="muted">{m.note}</p>}
      </Card>

      {/* Final skor: girildiyse herkese gorunur */}
      {m.home_score != null && m.away_score != null && (
        <Card>
          <Eyebrow>SONUÇ</Eyebrow>
          <div
            className="row"
            style={{ justifyContent: "space-around", alignItems: "center", marginTop: 12 }}
          >
            <div style={{ textAlign: "center", flex: 1 }}>
              <div className="muted" style={{ fontSize: "var(--text-caption)" }}>
                {m.home_label ?? (m.match_kind === "ic" ? "Takım 1" : "Biz")}
              </div>
              <div className="big-score">{m.home_score}</div>
            </div>
            <span className="big-score muted">–</span>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div className="muted" style={{ fontSize: "var(--text-caption)" }}>
                {m.away_label ?? (m.match_kind === "ic" ? "Takım 2" : "Rakip")}
              </div>
              <div className="big-score">{m.away_score}</div>
            </div>
          </div>
        </Card>
      )}

      {/* Anket */}
      {isPoll && (
        <Card>
          <Eyebrow>HANGİ SEÇENEKLERE KATILABİLİRSİN?</Eyebrow>
          {m.poll_closes_at && (
            <p
              className="muted"
              style={{ margin: "8px 0 0", fontSize: "var(--text-caption)" }}
            >
              {data.pollExpired
                ? "Anket süresi doldu. Hiç oy verilmediği için yönetici bir seçenek seçmeli."
                : `Anket ${shortDate(m.poll_closes_at)} ${clockTime(m.poll_closes_at)}'de kapanıyor; en çok oy alan otomatik kesinleşir.`}
            </p>
          )}
          <div style={{ marginTop: 8 }}>
            {data.options.map((o) => {
              const on = picked.has(o.id);
              return (
                <button
                  key={o.id}
                  className={`option-row ${on ? "option-row-on" : ""}`}
                  onClick={() =>
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (next.has(o.id)) next.delete(o.id);
                      else next.add(o.id);
                      return next;
                    })
                  }
                >
                  <span className="grow">
                    <strong>
                      {shortDate(o.startsAt)} · {clockTime(o.startsAt)}
                    </strong>
                    <div className="muted">
                      {o.location} · {o.voteCount} oy
                    </div>
                  </span>
                  <span>{on ? "✓" : ""}</span>
                </button>
              );
            })}
          </div>

          <div className="stack" style={{ marginTop: 12 }}>
            <button
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    api.post(`/api/groups/${groupId}/matches/${matchId}/poll`, {
                      available: true,
                      optionIds: [...picked],
                    }),
                  "Kaydedilemedi."
                )
              }
            >
              Seçimimi kaydet
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    api.post(`/api/groups/${groupId}/matches/${matchId}/poll`, {
                      available: false,
                      optionIds: [],
                    }),
                  "Kaydedilemedi."
                )
              }
            >
              Hiçbirine katılamam
            </button>
          </div>

          {data.myPollResponse && (
            <p className="muted" style={{ marginBottom: 0 }}>
              {data.myPollResponse.available
                ? "Cevabın kaydedildi."
                : "Katılamayacağını bildirdin."}
            </p>
          )}
        </Card>
      )}

      {/* Yonetici: anketi kesinlestir */}
      {isPoll && data.isOwner && (
        <Card>
          <Eyebrow>ANKETİ KAPAT VE MAÇI PLANLA</Eyebrow>
          {data.options.map((o) => (
            <div
              key={o.id}
              className="row"
              style={{
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: "1px solid var(--border-default)",
              }}
            >
              <div className="grow">
                <strong>
                  {shortDate(o.startsAt)} · {clockTime(o.startsAt)}
                </strong>
                <div className="muted">
                  {o.location} · {o.voteCount} oy
                </div>
              </div>
              <button
                className="small"
                disabled={busy}
                onClick={() => {
                  if (
                    !confirm(
                      `${shortDate(o.startsAt)} ${clockTime(o.startsAt)} · ${o.location} kesinleşsin mi?`
                    )
                  )
                    return;
                  run(
                    () =>
                      api.post(`/api/groups/${groupId}/matches/${matchId}/finalize`, {
                        optionId: o.id,
                      }),
                    "Kesinleştirilemedi."
                  );
                }}
              >
                Seç
              </button>
            </div>
          ))}
        </Card>
      )}

      {/* Yoklama */}
      {m.status === "scheduled" && (
        <Card>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <Eyebrow>YOKLAMA</Eyebrow>
            <strong style={{ fontFamily: "var(--font-display)" }}>
              {attendees.length}
              {m.required_players ? `/${m.required_players}` : ""}
            </strong>
          </div>

          {rsvpOpen && data.myAttendance === null && (
            <InlineMessage tone="warning">
              Bu maç için katılım bildirmedin.
            </InlineMessage>
          )}

          {rsvpOpen && (
            <div className="row" style={{ marginTop: 12, marginBottom: 12 }}>
              <button
                className={data.myAttendance === "yes" ? "" : "secondary"}
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      api.post(`/api/groups/${groupId}/matches/${matchId}/attendance`, {
                        status: "yes",
                      }),
                    "Kaydedilemedi."
                  )
                }
              >
                Katılıyorum
              </button>
              <button
                className={data.myAttendance === "no" ? "danger" : "secondary"}
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      api.post(`/api/groups/${groupId}/matches/${matchId}/attendance`, {
                        status: "no",
                      }),
                    "Kaydedilemedi."
                  )
                }
              >
                Katılmıyorum
              </button>
            </div>
          )}

          {data.rsvpClosesAt && (
            <p className="muted" style={{ margin: "0 0 10px", fontSize: "var(--text-caption)" }}>
              {new Date(data.rsvpClosesAt).getTime() > Date.now()
                ? `Katılım ${shortDate(data.rsvpClosesAt)} ${clockTime(data.rsvpClosesAt)}'de kapanıyor.`
                : "Katılım kapandı."}
            </p>
          )}

          {attendees.length === 0 ? (
            <p className="muted" style={{ marginBottom: 0 }}>
              Henüz katılan yok.
            </p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {attendees.map((a) => (
                <li key={a.user_id}>{a.name}</li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Senden beklenen eylem: amber. */}
      {data.rating.open && (
        <Link href={`/group/${groupId}/match/${matchId}/rate`}>
          <button className="full accent">Maçı oyla</button>
        </Link>
      )}

      {/* Skor girisi */}
      {data.rating.played && data.isOwner && (
        <Card>
          <Eyebrow>SKOR</Eyebrow>
          <div className="row" style={{ marginTop: 8, flexWrap: "nowrap" }}>
            <input
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              inputMode="numeric"
              placeholder={m.match_kind === "ic" ? "Takım 1" : "Biz"}
              style={{ width: "100%" }}
            />
            <span className="big-score muted">–</span>
            <input
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              inputMode="numeric"
              placeholder={m.match_kind === "ic" ? "Takım 2" : "Rakip"}
              style={{ width: "100%" }}
            />
          </div>
          <button
            className="secondary full"
            style={{ marginTop: 12 }}
            disabled={busy}
            onClick={() =>
              run(
                () =>
                  api.patch(`/api/groups/${groupId}/matches/${matchId}/result`, {
                    homeScore: Number(homeScore),
                    awayScore: Number(awayScore),
                  }),
                "Skor kaydedilemedi."
              )
            }
          >
            Skoru kaydet
          </button>
        </Card>
      )}

      {/* Maç puanlama sonucu: oyuncularin aldigi ortalama puan */}
      {data.rating.results.length > 0 && (
        <Card>
          <Eyebrow>MAÇ PUANLARI</Eyebrow>
          <p className="muted" style={{ margin: "6px 0 4px", fontSize: "var(--text-caption)" }}>
            Oyuncuların bu maçta arkadaşlarından aldığı ortalama puan (10 üzerinden).
          </p>
          <div className="roster">
            {data.rating.results.map((r) => (
              <div key={r.userId} className="roster-row">
                <span className="grow">
                  <span className="roster-name">{r.name}</span>
                  <div className="roster-meta">{r.raterCount} oy</div>
                </span>
                <span className="roster-score">{r.average.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Kadrolar: yalnizca takim ici maclarda */}
      {m.match_kind === "ic" && !["poll", "completed", "cancelled"].includes(data.phase) && (
        <Card>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <Eyebrow>KADROLAR</Eyebrow>
            {data.squads && (
              <span className="muted">
                {data.squads.home.length}-{data.squads.away.length}
                {data.squads.locked ? " · kilitli" : ""}
              </span>
            )}
          </div>
          <p className="muted" style={{ margin: "8px 0 12px" }}>
            {data.squads
              ? "Kadrolar oluşturuldu."
              : "Yoklamaya katılanlar iki takıma bölünmedi."}
          </p>
          <Link href={`/group/${groupId}/match/${matchId}/squads`}>
            <button className="secondary full">Kadroları yönet</button>
          </Link>
        </Card>
      )}

      {/* Tamamlanmis mac ozeti: skor + kadrolar */}
      {data.phase === "completed" && data.squads && (
        <Card>
          <Eyebrow>KADROLAR</Eyebrow>
          <div style={{ marginTop: 8 }}>
            <strong>
              Takım 1{" "}
              {m.home_score != null && m.away_score != null && (
                <span className="muted">
                  {m.home_score > m.away_score ? "(kazandı)" : m.home_score < m.away_score ? "(kaybetti)" : "(berabere)"}
                </span>
              )}
            </strong>
            <ul style={{ margin: "4px 0 12px", paddingLeft: 18 }}>
              {data.squads.home.map((p) => (
                <li key={p.id}>
                  {p.name}
                  {p.isGuest ? " (misafir)" : ""}
                </li>
              ))}
            </ul>
            <strong>
              Takım 2{" "}
              {m.home_score != null && m.away_score != null && (
                <span className="muted">
                  {m.away_score > m.home_score ? "(kazandı)" : m.away_score < m.home_score ? "(kaybetti)" : "(berabere)"}
                </span>
              )}
            </strong>
            <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
              {data.squads.away.map((p) => (
                <li key={p.id}>
                  {p.name}
                  {p.isGuest ? " (misafir)" : ""}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      {/* Maci yalnizca olusturan yonetici iptal edebilir */}
      {data.isOwner && m.status !== "completed" && m.status !== "cancelled" && (
        <Card>
          <Eyebrow>MAÇ AYARLARI</Eyebrow>
          <p className="muted">
            İptal edilen maç listede &quot;İptal&quot; olarak görünür ve yoklama
            kapanır.
          </p>
          <button className="danger full" onClick={cancelMatch} disabled={busy}>
            Maçı iptal et
          </button>
        </Card>
      )}
    </div>
  );
}
