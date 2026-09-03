"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge, Card, ErrorText, Eyebrow, Field } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";
import { clockTime, countdownLabel, shortDate } from "@/lib/dateFormat";
import { MatchPhase, PHASE_LABEL } from "@/lib/matchStatus";

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
  };
  isOwner: boolean;
  phase: MatchPhase;
  options: { id: string; startsAt: string; location: string; voteCount: number }[];
  myPollResponse: { available: boolean } | null;
  myOptionIds: string[];
  attendance: { user_id: string; status: "yes" | "no"; name: string }[];
  myAttendance: "yes" | "no" | null;
  rating: { open: boolean; played: boolean; participants: { id: string; name: string }[] };
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
          <Link href="/matches">← Maçlar</Link>
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
        <Link href="/matches">← Maçlar</Link>
      </p>

      <ErrorText>{error}</ErrorText>

      <Card raised>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <Badge
            tone={
              data.phase === "rating" || data.phase === "poll"
                ? "accent"
                : data.phase === "cancelled"
                ? "danger"
                : data.phase === "completed"
                ? "neutral"
                : "brand"
            }
          >
            {PHASE_LABEL[data.phase]}
          </Badge>
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
          <div style={{ color: "var(--text-link)", fontSize: 13, fontWeight: 500 }}>
            {countdownLabel(m.scheduled_at)}
          </div>
        )}
        {m.note && <p className="muted">{m.note}</p>}
      </Card>

      {/* Anket */}
      {isPoll && (
        <Card>
          <Eyebrow>HANGİ SEÇENEKLERE KATILABİLİRSİN?</Eyebrow>
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

      {data.rating.open && (
        <Link href={`/group/${groupId}/match/${matchId}/rate`}>
          <button className="full">Maçı oyla</button>
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
