"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Card, ErrorText, PageHeader } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";
import { shortDate } from "@/lib/dateFormat";

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  group_id: string | null;
  match_id: string | null;
  group_name: string | null;
  read_at: string | null;
  created_at: string;
};

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.get<{ notifications: Notification[] }>("/api/notifications");
      setItems(d.notifications);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markAll() {
    await api.patch("/api/notifications", {});
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  }

  const unread = items.filter((n) => !n.read_at).length;

  return (
    <div>
      <PageHeader
        eyebrow="BİLDİRİMLER"
        title={unread > 0 ? `${unread} yeni` : "Bildirimler"}
        action={
          // Ayarlar HER ZAMAN gorunur: bildirimden rahatsiz olan kisi
          // tam da bu ekrandayken kapatmak istiyor, aramak zorunda
          // kalmamali.
          <div className="row" style={{ gap: 8 }}>
            {unread > 0 && (
              <button className="secondary small" onClick={markAll}>
                Tümünü okundu yap
              </button>
            )}
            <Link href="/bildirim-ayarlari">
              <button className="secondary small">Ayarlar</button>
            </Link>
          </div>
        }
      />

      <ErrorText>{error}</ErrorText>
      {loading && <p className="muted">Yükleniyor...</p>}

      {!loading && items.length === 0 && (
        <Card>
          <p className="muted" style={{ margin: 0 }}>
            Henüz bildirimin yok. Takımında bir maç açıldığında ya da tarih
            kesinleştiğinde burada göreceksin.
          </p>
        </Card>
      )}

      {items.map((n) => {
        const href = n.group_id && n.match_id
          ? `/group/${n.group_id}/match/${n.match_id}`
          : n.group_id
          ? `/group/${n.group_id}`
          : null;
        const card = (
          <Card className={!n.read_at ? "needs-action" : ""}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{n.title}</strong>
              {!n.read_at && <Badge tone="accent">Yeni</Badge>}
            </div>
            {n.body && <p className="muted" style={{ margin: "6px 0 0" }}>{n.body}</p>}
            <p className="muted" style={{ margin: "6px 0 0", fontSize: "var(--text-caption)" }}>
              {n.group_name ? `${n.group_name} · ` : ""}
              {shortDate(n.created_at)}
            </p>
          </Card>
        );
        return href ? (
          <Link
            key={n.id}
            href={href}
            style={{ display: "block", color: "inherit" }}
            onClick={() => api.patch("/api/notifications", { id: n.id }).catch(() => {})}
          >
            {card}
          </Link>
        ) : (
          <div key={n.id}>{card}</div>
        );
      })}
    </div>
  );
}
