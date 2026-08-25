"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Group = {
  id: string;
  name: string;
  invite_code: string;
  member_count: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [userName, setUserName] = useState<string>("");

  async function loadGroups() {
    const res = await fetch("/api/groups");
    const data = await res.json();
    if (res.ok) setGroups(data.groups);
    setLoading(false);
  }

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUserName(d.user?.name || ""));
    loadGroups();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setName("");
      await loadGroups();
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setInviteCode("");
      await loadGroups();
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div>
      <nav className="top">
        <h1>MatchRating</h1>
        <div className="row">
          {userName && <span>Merhaba, {userName}</span>}
          <button className="secondary" onClick={handleLogout}>
            Çıkış Yap
          </button>
        </div>
      </nav>

      <div className="card">
        <h3>Yeni Takım Oluştur</h3>
        <form onSubmit={handleCreate} className="row">
          <input
            placeholder="Takım adı"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <button type="submit" disabled={busy}>
            Oluştur
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Davet Koduyla Katıl</h3>
        <form onSubmit={handleJoin} className="row">
          <input
            placeholder="Davet kodu (örn: AB12CD)"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            required
          />
          <button type="submit" disabled={busy}>
            Katıl
          </button>
        </form>
      </div>

      {error && <p className="error">{error}</p>}

      <h3>Takımlarım</h3>
      {loading ? (
        <p>Yükleniyor...</p>
      ) : groups.length === 0 ? (
        <p>Henüz bir takımın yok. Yukarıdan bir takım oluştur ya da davet koduyla katıl.</p>
      ) : (
        groups.map((g) => (
          <Link key={g.id} href={`/group/${g.id}`} style={{ textDecoration: "none" }}>
            <div className="card" style={{ cursor: "pointer" }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{g.name}</strong>
                <span className="pill">{g.member_count} üye</span>
              </div>
              <div>Davet kodu: <strong>{g.invite_code}</strong></div>
            </div>
          </Link>
        ))
      )}
    </div>
  );
}
