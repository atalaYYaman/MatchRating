"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card, ErrorText, PageHeader } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";

type Pref = {
  kind: string;
  label: string;
  description: string;
  enabled: boolean;
};

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<Pref[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.get<{ prefs: Pref[] }>("/api/notifications/prefs");
      setPrefs(d.prefs);
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

  async function toggle(kind: string, enabled: boolean) {
    // Once ekranda degistiriyoruz: tik isaretinin beklemesi kullaniciya
    // "calismadi" hissi veriyor. Istek basarisiz olursa geri aliyoruz.
    setPrefs((prev) => prev.map((p) => (p.kind === kind ? { ...p, enabled } : p)));
    setSaving(kind);
    setError(null);
    try {
      await api.patch("/api/notifications/prefs", { kind, enabled });
    } catch (err) {
      setPrefs((prev) => prev.map((p) => (p.kind === kind ? { ...p, enabled: !enabled } : p)));
      setError(err instanceof ApiError ? err.message : "Kaydedilemedi.");
    } finally {
      setSaving(null);
    }
  }

  const off = prefs.filter((p) => !p.enabled).length;

  return (
    <div>
      <Link href="/bildirimler" className="back-link">
        ← Bildirimler
      </Link>

      <PageHeader
        eyebrow="BİLDİRİM AYARLARI"
        title="Neyden haberdar olayım?"
      />

      <Card>
        <p className="muted" style={{ margin: 0 }}>
          Kaldırdığın bildirimler ne telefonuna düşer ne de Bildirimler
          ekranında görünür. Hepsi varsayılan olarak açık.
          {off > 0 ? ` Şu an ${off} tanesi kapalı.` : ""}
        </p>
      </Card>

      <ErrorText>{error}</ErrorText>
      {loading && <p className="muted">Yükleniyor...</p>}

      {prefs.map((p) => (
        <Card key={p.kind}>
          <label
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "flex-start",
              cursor: "pointer",
              margin: 0,
            }}
          >
            <input
              type="checkbox"
              checked={p.enabled}
              disabled={saving === p.kind}
              onChange={(e) => toggle(p.kind, e.target.checked)}
              style={{ width: 20, height: 20, marginTop: 2, flexShrink: 0 }}
            />
            <span>
              <strong>{p.label}</strong>
              <span
                className="muted"
                style={{ display: "block", marginTop: 2, fontSize: "var(--text-caption)" }}
              >
                {p.description}
              </span>
            </span>
          </label>
        </Card>
      ))}
    </div>
  );
}
