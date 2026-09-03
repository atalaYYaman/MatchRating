"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SKILLS } from "@/lib/skills";
import { positionLabel, PositionKey } from "@/lib/positions";

type Member = {
  id: string;
  name: string;
  account_name: string;
  nickname: string | null;
  email: string;
  record: { played: number; wins: number; draws: number; losses: number };
};
type Group = {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  ratings_breakdown_public?: boolean;
};
type Rating = {
  userId: string;
  name: string;
  overall: number;
  skills: Record<string, number>;
  voteCount: number;
  hasVotes: boolean;
  hasEnoughVotes: boolean;
  primaryPosition: PositionKey | null;
  secondaryPosition: PositionKey | null;
};

export default function GroupPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const groupId = params.id;

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [ratingsBreakdownPublic, setRatingsBreakdownPublic] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNickname, setEditNickname] = useState("");
  const [savingMember, setSavingMember] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [groupRes, ratingsRes] = await Promise.all([
        fetch(`/api/groups/${groupId}`, { cache: "no-store" }),
        fetch(`/api/groups/${groupId}/ratings`, { cache: "no-store" }),
      ]);
      const groupData = await groupRes.json();
      const ratingsData = await ratingsRes.json();
      if (!groupRes.ok) {
        setError(groupData.error || "Takım yüklenemedi.");
        return;
      }
      setGroup(groupData.group);
      setMembers(groupData.members);
      setIsOwner(Boolean(groupData.isOwner));
      setMeId(groupData.meId ?? null);
      setRatingsBreakdownPublic(Boolean(groupData.ratingsBreakdownPublic));
      if (ratingsRes.ok) setRatings(ratingsData.ratings);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveNickname(userId: string) {
    setSavingMember(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: editNickname }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Takma ad kaydedilemedi.");
        return;
      }
      setEditingId(null);
      await load(true);
    } finally {
      setSavingMember(false);
    }
  }

  async function deleteGroup() {
    if (
      !confirm(
        `"${group?.name}" takımı kalıcı olarak silinecek. Tüm maçlar, oylar ve puanlar da gidecek. Emin misin?`
      )
    )
      return;
    setSavingMember(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Takım silinemedi.");
        return;
      }
      router.push("/groups");
      router.refresh();
    } finally {
      setSavingMember(false);
    }
  }

  async function leaveGroup() {
    if (!confirm("Bu takımdan ayrılacaksın. Oyların da silinecek. Emin misin?")) return;
    setSavingMember(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/members/${meId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Takımdan ayrılınamadı.");
        return;
      }
      router.push("/groups");
      router.refresh();
    } finally {
      setSavingMember(false);
    }
  }

  async function removeMember(member: Member) {
    if (!confirm(`${member.name} gruptan çıkarılsın mı? Oyları da silinir.`)) return;
    setSavingMember(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/members/${member.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Üye çıkarılamadı.");
        return;
      }
      await load(true);
    } finally {
      setSavingMember(false);
    }
  }

  if (loading) return <p>Yükleniyor...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!group) return null;

  // Kendine oy verilemez; her oyuncu icin oylayabilecek uye sayisi N-1.
  const possibleVoters = Math.max(0, members.length - 1);

  return (
    <div>
      <p><Link href="/groups">← Takımlarım</Link></p>
      <h1>{group.name}</h1>
      <p>
        Davet kodu: <strong>{group.invite_code}</strong> — arkadaşların bu kodla
        katılabilir.
      </p>

      <div className="row" style={{ marginBottom: 20 }}>
        <Link href={`/group/${groupId}/vote`}><button>Oylama Yap</button></Link>
        <Link href={`/group/${groupId}/teams`}><button className="secondary">Takımları Oluştur</button></Link>
        {(isOwner || ratingsBreakdownPublic) && (
          <Link href={`/group/${groupId}/breakdown`}>
            <button className="secondary">Puan Detayları</button>
          </Link>
        )}
        <button className="secondary" onClick={() => load(true)} disabled={refreshing}>
          {refreshing ? "Yenileniyor..." : "Listeleri Yenile"}
        </button>
      </div>

      <button
        type="button"
        className="collapse-toggle"
        onClick={() => setMembersOpen((open) => !open)}
        aria-expanded={membersOpen}
      >
        <span aria-hidden="true">{membersOpen ? "▼" : "▶"}</span>
        Üyeler ({members.length})
      </button>
      {membersOpen && (
        <div className="card">
          {actionError && <p className="error">{actionError}</p>}
          <table>
            <thead>
              <tr>
                <th>İsim</th>
                <th>E-posta</th>
                <th>G-B-M</th>
                {isOwner && <th>İşlem</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isGroupOwner = m.id === group.owner_id;
                const editing = editingId === m.id;
                return (
                  <tr key={m.id}>
                    <td>
                      {editing ? (
                        <input
                          value={editNickname}
                          onChange={(e) => setEditNickname(e.target.value)}
                          placeholder={m.account_name || m.name}
                          maxLength={40}
                          disabled={savingMember}
                          style={{ width: "100%", maxWidth: 180 }}
                        />
                      ) : (
                        <>
                          {m.name}
                          {isGroupOwner && <span className="pill" style={{ marginLeft: 6 }}>yönetici</span>}
                          {m.nickname && m.account_name && m.nickname !== m.account_name && (
                            <span style={{ color: "#888", marginLeft: 6, fontSize: 12 }}>
                              ({m.account_name})
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td>{m.email}</td>
                    <td>
                      {m.record.played > 0
                        ? `${m.record.wins}-${m.record.draws}-${m.record.losses}`
                        : "—"}
                    </td>
                    {isOwner && (
                      <td>
                        {editing ? (
                          <div className="row">
                            <button
                              className="small"
                              onClick={() => saveNickname(m.id)}
                              disabled={savingMember}
                            >
                              Kaydet
                            </button>
                            <button
                              className="secondary small"
                              onClick={() => setEditingId(null)}
                              disabled={savingMember}
                            >
                              İptal
                            </button>
                          </div>
                        ) : (
                          <div className="row">
                            <button
                              className="secondary small"
                              onClick={() => {
                                setEditingId(m.id);
                                setEditNickname(m.nickname || m.name);
                                setActionError(null);
                              }}
                              disabled={savingMember}
                            >
                              Takma ad
                            </button>
                            {!isGroupOwner && (
                              <button
                                className="danger small"
                                onClick={() => removeMember(m)}
                                disabled={savingMember}
                              >
                                Çıkar
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
        <h3 style={{ margin: 0 }}>Yetenek Puanları (ortalama)</h3>
        <button className="secondary small" onClick={() => load(true)} disabled={refreshing}>
          {refreshing ? "Yenileniyor..." : "Yenile"}
        </button>
      </div>
      <p style={{ color: "#888", fontSize: 13, margin: "4px 0 8px" }}>
        İsim yanındaki oran, oyuncuyu oylayan üye / oylayabilecek üye sayısıdır
        ({possibleVoters} kişi oylayabilir).
      </p>
      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>İsim</th>
              <th>1. Mevki</th>
              <th>2. Mevki</th>
              {SKILLS.map((s) => <th key={s.key}>{s.label}</th>)}
              <th>Genel</th>
            </tr>
          </thead>
          <tbody>
            {ratings.map((r) => {
              const voteRatio = `${r.voteCount}/${possibleVoters}`;
              return (
                <tr key={r.userId}>
                  <td>
                    {r.name}
                    {!r.hasVotes && (
                      <span className="pill" style={{ marginLeft: 6 }}>oy yok ({voteRatio})</span>
                    )}
                    {r.hasVotes && !r.hasEnoughVotes && (
                      <span className="pill" style={{ marginLeft: 6 }}>
                        Yetersiz oy ({voteRatio})
                      </span>
                    )}
                    {r.hasEnoughVotes && (
                      <span className="pill" style={{ marginLeft: 6 }}>{voteRatio} oy</span>
                    )}
                  </td>
                  <td>{positionLabel(r.primaryPosition)}</td>
                  <td>{positionLabel(r.secondaryPosition)}</td>
                  {SKILLS.map((s) => <td key={s.key}>{r.skills[s.key]}</td>)}
                  <td><strong>{r.overall}</strong></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Geri alinamaz islemler en altta, ayri bir blokta */}
      <div className="card" style={{ marginTop: "var(--space-6)" }}>
        <span className="eyebrow">TAKIM AYARLARI</span>
        {actionError && <p className="error">{actionError}</p>}
        {isOwner ? (
          <>
            <p className="muted">
              Takımı silmek geri alınamaz; tüm maçlar, oylar ve puanlar da silinir.
            </p>
            <button className="danger" onClick={deleteGroup} disabled={savingMember}>
              Takımı sil
            </button>
          </>
        ) : (
          <>
            <p className="muted">
              Takımdan ayrılırsan bu takımdaki oyların silinir. Davet koduyla tekrar
              katılabilirsin.
            </p>
            <button className="danger" onClick={leaveGroup} disabled={savingMember}>
              Takımdan ayrıl
            </button>
          </>
        )}
      </div>
    </div>
  );
}
