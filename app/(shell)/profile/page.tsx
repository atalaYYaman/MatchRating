"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, Eyebrow, InlineMessage, PageHeader } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";
import { useActiveGroup } from "@/lib/active-group";
import { brand } from "@/lib/brand";

type Me = {
  user: { id: string; name: string; email: string } | null;
  isAdmin?: boolean;
  emailVerified?: boolean;
};

export default function ProfilePage() {
  const router = useRouter();
  const { groups, activeGroup } = useActiveGroup();
  const [user, setUser] = useState<Me["user"]>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [verified, setVerified] = useState(true);
  const [sending, setSending] = useState(false);
  const [sentMsg, setSentMsg] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Me>("/api/auth/me")
      .then((d) => {
        setUser(d.user);
        setIsAdmin(Boolean(d.isAdmin));
        setVerified(d.emailVerified !== false);
      })
      .catch(() => setUser(null));
  }, []);

  async function logout() {
    await api.post("/api/auth/logout");
    router.push("/login");
    router.refresh();
  }

  return (
    <div>
      <PageHeader eyebrow={brand.nameUpper} title="Profil" />

      <Card raised>
        <h2 style={{ margin: 0 }}>{user?.name ?? "—"}</h2>
        <span className="muted">{user?.email}</span>
      </Card>

      <Card>
        <Eyebrow>ÖZET</Eyebrow>
        <div className="row" style={{ marginTop: 12, gap: 32 }}>
          <div className="stack">
            <span className="stats-value">{groups.length}</span>
            <Eyebrow>TAKIM</Eyebrow>
          </div>
          <div className="stack">
            <strong>{activeGroup?.name ?? "—"}</strong>
            <Eyebrow>AKTİF TAKIM</Eyebrow>
          </div>
        </div>
      </Card>

      {!verified && (
        <Card>
          <InlineMessage tone="warning">
            E-posta adresin doğrulanmadı. Doğrulanmış adres, şifreni unuttuğunda
            hesabını geri almanın tek yolu.
          </InlineMessage>
          {sentMsg && <p className="muted" style={{ margin: "0 0 10px" }}>{sentMsg}</p>}
          <button
            className="secondary full"
            disabled={sending}
            onClick={async () => {
              setSending(true);
              setSentMsg(null);
              try {
                await api.post("/api/auth/verify/send");
                setSentMsg("Doğrulama e-postası gönderildi. Gelen kutunu kontrol et.");
              } catch (err) {
                setSentMsg(
                  err instanceof ApiError ? err.message : "Gönderilemedi."
                );
              } finally {
                setSending(false);
              }
            }}
          >
            {sending ? "Gönderiliyor..." : "Doğrulama e-postası gönder"}
          </button>
        </Card>
      )}

      {isAdmin && (
        <Card style={{ padding: 0 }}>
          <Link href="/admin" className="switcher-row">
            Yönetim paneli
          </Link>
        </Card>
      )}

      <Card style={{ padding: 0 }}>
        <Link href="/bildirimler" className="switcher-row">
          Bildirimler
        </Link>
        <Link href="/geri-bildirim" className="switcher-row">
          Geri bildirim gönder
        </Link>
        <Link href="/gizlilik" className="switcher-row">
          Gizlilik politikası
        </Link>
        <Link href="/hesap-silme" className="switcher-row">
          Hesap silme talebi
        </Link>
      </Card>

      <button className="secondary full" onClick={logout}>
        Çıkış yap
      </button>
    </div>
  );
}
