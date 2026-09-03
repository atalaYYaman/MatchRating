"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge, Card, ErrorText, Eyebrow } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";
import { shortDate } from "@/lib/dateFormat";

type Season = {
  id: string;
  name: string;
  status: "active" | "closed";
  created_at: string;
  closed_at: string | null;
  matchCount: number;
};

export default function SeasonsPage() {
  const params = useParams<{ id: string }>();
  const groupId = params.id;

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ seasons: Season[]; isOwner: boolean }>(
        `/api/groups/${groupId}/seasons`
      );
      setSeasons(data.seasons);
      setIsOwner(data.isOwner);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sezonlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  async function closeSeason() {
    const active = seasons.find((s) => s.status === "active");
    if (
      !confirm(
        `"${active?.name}" kapatılacak; o anki sıralama ve galibiyet kaydı özet olarak dondurulacak ve yeni bir sezon başlayacak. Emin misin?`
      )
    )
      return;
    setClosing(true);
    setError(null);
    try {
      await api.post(`/api/groups/${groupId}/seasons`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sezon kapatılamadı.");
    } finally {
      setClosing(false);
    }
  }

  if (loading) return <p className="muted">Yükleniyor...</p>;

  return (
    <div>
      <p>
        <Link href={`/group/${groupId}`}>← Takıma dön</Link>
      </p>
      <h1>Sezonlar</h1>
      <p className="muted" style={{ marginTop: 4 }}>
        Sezon, maçları ve galibiyet kaydını kapsayan bir dönemdir. Yönetici sezonu
        kapattığında o anki durum özet olarak saklanır; yetenek puanları sezonlar
        arası korunur.
      </p>

      <ErrorText>{error}</ErrorText>

      {seasons.map((s) => (
        <Link
          key={s.id}
          href={`/group/${groupId}/season/${s.id}`}
          style={{ display: "block", color: "inherit" }}
        >
          <Card>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <strong>{s.name}</strong>
                <div className="muted" style={{ marginTop: 2 }}>
                  {s.matchCount} maç ·{" "}
                  {s.status === "closed" && s.closed_at
                    ? `${shortDate(s.created_at)} – ${shortDate(s.closed_at)}`
                    : `${shortDate(s.created_at)} – devam ediyor`}
                </div>
              </div>
              <Badge tone={s.status === "active" ? "brand" : "neutral"}>
                {s.status === "active" ? "Aktif" : "Kapandı"}
              </Badge>
            </div>
          </Card>
        </Link>
      ))}

      {isOwner && seasons.some((s) => s.status === "active") && (
        <div className="card" style={{ marginTop: "var(--space-6)" }}>
          <Eyebrow>SEZON YÖNETİMİ</Eyebrow>
          <p className="muted">
            Aktif sezonu kapatınca özeti dondurulur ve otomatik adlı yeni bir sezon
            başlar. Bu işlem geri alınamaz.
          </p>
          <button className="danger" onClick={closeSeason} disabled={closing}>
            {closing ? "Kapatılıyor..." : "Aktif sezonu kapat"}
          </button>
        </div>
      )}
    </div>
  );
}
