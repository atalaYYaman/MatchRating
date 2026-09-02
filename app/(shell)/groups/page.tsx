"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Card, ErrorText, Eyebrow, Field, PageHeader } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";
import { useActiveGroup } from "@/lib/active-group";

export default function GroupsPage() {
  const { groups, activeGroup, setActiveGroup, refresh, loading } = useActiveGroup();

  const [newGroupName, setNewGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createGroup() {
    if (newGroupName.trim().length < 2) {
      setError("Takım adı en az 2 karakter olmalı.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/groups", { name: newGroupName.trim() });
      setNewGroupName("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Takım oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function joinGroup() {
    if (!inviteCode.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/groups/join", { inviteCode: inviteCode.trim() });
      setInviteCode("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Takıma katılınamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="MATCHRATING" title="Takımlarım" />

      <ErrorText>{error}</ErrorText>

      {!loading && groups.length === 0 && (
        <Card>
          <p className="muted" style={{ margin: 0 }}>
            Henüz bir takımın yok. Aşağıdan yeni bir takım kur ya da davet koduyla
            katıl.
          </p>
        </Card>
      )}

      {groups.map((g) => {
        const isActive = g.id === activeGroup?.id;
        return (
          <Card key={g.id} raised={isActive}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2 style={{ margin: 0 }}>{g.name}</h2>
              {isActive ? (
                <Badge tone="brand">Aktif</Badge>
              ) : (
                <button className="secondary small" onClick={() => setActiveGroup(g.id)}>
                  Aktif yap
                </button>
              )}
            </div>

            <div className="row" style={{ gap: 16, marginTop: 8 }}>
              <span className="muted">{g.member_count} üye</span>
              <span className="muted">Davet kodu: {g.invite_code}</span>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <Link href={`/group/${g.id}`}>
                <button className="secondary small">Takıma git</button>
              </Link>
              <Link href={`/group/${g.id}/match/new`}>
                <button className="small">Maç oluştur</button>
              </Link>
            </div>
          </Card>
        );
      })}

      <Card>
        <Eyebrow>YENİ TAKIM OLUŞTUR</Eyebrow>
        <div style={{ marginTop: 8 }}>
          <Field
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Takım adı"
          />
          <button className="full" onClick={createGroup} disabled={busy}>
            Oluştur
          </button>
        </div>
      </Card>

      <Card>
        <Eyebrow>DAVET KODUYLA KATIL</Eyebrow>
        <div style={{ marginTop: 8 }}>
          <Field
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Örn: AB12CD"
          />
          <button className="secondary full" onClick={joinGroup} disabled={busy}>
            Katıl
          </button>
        </div>
      </Card>
    </div>
  );
}
