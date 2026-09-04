"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, Eyebrow, PageHeader } from "@/components/ui";
import { api } from "@/lib/client-api";
import { useActiveGroup } from "@/lib/active-group";

type Me = { user: { id: string; name: string; email: string } | null };

export default function ProfilePage() {
  const router = useRouter();
  const { groups, activeGroup } = useActiveGroup();
  const [user, setUser] = useState<Me["user"]>(null);

  useEffect(() => {
    api
      .get<Me>("/api/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
  }, []);

  async function logout() {
    await api.post("/api/auth/logout");
    router.push("/login");
    router.refresh();
  }

  return (
    <div>
      <PageHeader eyebrow="MATCHRATING" title="Profil" />

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

      <Card style={{ padding: 0 }}>
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
