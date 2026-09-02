"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Card, ErrorText, Eyebrow, Field } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";
import { clockTime, shortDate, toLocalInputValue } from "@/lib/dateFormat";

type Mode = "poll" | "fixed";
type Kind = "ic" | "dis";
type Option = { startsAt: string; location: string };

function defaultStart() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(21, 0, 0, 0);
  return toLocalInputValue(d);
}

export default function NewMatchPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const groupId = params.id;

  const [mode, setMode] = useState<Mode>("fixed");
  const [kind, setKind] = useState<Kind>("ic");
  const [requiredPlayers, setRequiredPlayers] = useState("14");
  const [note, setNote] = useState("");

  const [startsAt, setStartsAt] = useState(defaultStart());
  const [location, setLocation] = useState("");

  const [options, setOptions] = useState<Option[]>([]);
  const [draftDate, setDraftDate] = useState(defaultStart());
  const [draftLocation, setDraftLocation] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function addOption() {
    if (!draftDate || !draftLocation.trim()) {
      setError("Seçenek için tarih ve konum gir.");
      return;
    }
    setOptions((prev) => [
      ...prev,
      { startsAt: draftDate, location: draftLocation.trim() },
    ]);
    setDraftLocation("");
    setError(null);
  }

  async function submit() {
    setError(null);
    const required = Number(requiredPlayers);
    const body: Record<string, unknown> = {
      mode,
      matchKind: kind,
      requiredPlayers: Number.isFinite(required) && required > 0 ? required : null,
      note: note.trim() || null,
    };

    if (mode === "fixed") {
      if (!startsAt) return setError("Tarih ve saat seçmelisin.");
      if (!location.trim()) return setError("Konum girmelisin.");
      body.scheduledAt = new Date(startsAt).toISOString();
      body.location = location.trim();
    } else {
      if (options.length === 0) return setError("En az bir anket seçeneği ekle.");
      body.options = options.map((o) => ({
        startsAt: new Date(o.startsAt).toISOString(),
        location: o.location,
      }));
    }

    setSaving(true);
    try {
      await api.post(`/api/groups/${groupId}/matches`, body);
      router.push("/matches");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Maç oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p>
        <Link href="/matches">← Maçlar</Link>
      </p>
      <h1>Yeni Maç</h1>

      <ErrorText>{error}</ErrorText>

      <Card>
        <Eyebrow>MAÇ TİPİ</Eyebrow>
        <div className="segmented" style={{ marginTop: 8 }}>
          <button
            className={`segment ${mode === "fixed" ? "segment-active" : ""}`}
            onClick={() => setMode("fixed")}
          >
            Kesin maç
            <span>Bilgiler belli, yoklama alınır</span>
          </button>
          <button
            className={`segment ${mode === "poll" ? "segment-active" : ""}`}
            onClick={() => setMode("poll")}
          >
            Anket
            <span>Gün/saat için oy toplanır</span>
          </button>
        </div>
      </Card>

      <Card>
        <Eyebrow>RAKİP</Eyebrow>
        <div className="segmented" style={{ marginTop: 8 }}>
          <button
            className={`segment ${kind === "ic" ? "segment-active" : ""}`}
            onClick={() => setKind("ic")}
          >
            Takım içi
            <span>Kendi aramızda</span>
          </button>
          <button
            className={`segment ${kind === "dis" ? "segment-active" : ""}`}
            onClick={() => setKind("dis")}
          >
            Dış rakip
            <span>Başka takıma karşı</span>
          </button>
        </div>
      </Card>

      {mode === "fixed" ? (
        <Card>
          <Eyebrow>TARİH, SAAT VE KONUM</Eyebrow>
          <div style={{ marginTop: 8 }}>
            <div className="field">
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <Field
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Örn: Yıldız Halı Saha, Saha 2"
            />
          </div>
        </Card>
      ) : (
        <Card>
          <Eyebrow>ANKET SEÇENEKLERİ</Eyebrow>
          <p className="muted" style={{ marginTop: 8 }}>
            Her seçenek ayrı bir gün/saat/konum kombinasyonu. Üyeler katılabilecekleri
            seçenekleri işaretler.
          </p>

          {options.map((o, i) => (
            <div
              key={i}
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
                <div className="muted">{o.location}</div>
              </div>
              <button
                className="danger small"
                onClick={() => setOptions((prev) => prev.filter((_, x) => x !== i))}
              >
                Kaldır
              </button>
            </div>
          ))}

          <div style={{ marginTop: 12 }}>
            <div className="field">
              <input
                type="datetime-local"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
              />
            </div>
            <Field
              value={draftLocation}
              onChange={(e) => setDraftLocation(e.target.value)}
              placeholder="Konum"
            />
            <button className="secondary small" onClick={addOption}>
              Seçenek ekle
            </button>
          </div>
        </Card>
      )}

      <Card>
        <Field
          label="Gerekli oyuncu sayısı"
          value={requiredPlayers}
          onChange={(e) => setRequiredPlayers(e.target.value)}
          inputMode="numeric"
          placeholder="14"
        />
        <Field
          label="Not (isteğe bağlı)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Krampon getirin"
        />
      </Card>

      <button className="full" onClick={submit} disabled={saving}>
        {mode === "poll" ? "Anketi başlat" : "Maçı oluştur"}
      </button>
    </div>
  );
}
