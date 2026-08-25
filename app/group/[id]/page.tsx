"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { SKILLS } from "@/lib/skills";
import { positionLabel, PositionKey } from "@/lib/positions";

type Member = { id: string; name: string; email: string };
type Group = { id: string; name: string; invite_code: string };
type Rating = {
  userId: string;
  name: string;
  overall: number;
  skills: Record<string, number>;
  hasVotes: boolean;
  primaryPosition: PositionKey | null;
  secondaryPosition: PositionKey | null;
};

export default function GroupPage() {
  const params = useParams<{ id: string }>();
  const groupId = params.id;

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [groupRes, ratingsRes] = await Promise.all([
        fetch(`/api/groups/${groupId}`),
        fetch(`/api/groups/${groupId}/ratings`),
      ]);
      const groupData = await groupRes.json();
      const ratingsData = await ratingsRes.json();
      if (!groupRes.ok) {
        setError(groupData.error || "Takım yüklenemedi.");
        setLoading(false);
        return;
      }
      setGroup(groupData.group);
      setMembers(groupData.members);
      if (ratingsRes.ok) setRatings(ratingsData.ratings);
      setLoading(false);
    }
    load();
  }, [groupId]);

  if (loading) return <p>Yükleniyor...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!group) return null;

  return (
    <div>
      <p><Link href="/dashboard">← Takımlarım</Link></p>
      <h1>{group.name}</h1>
      <p>
        Davet kodu: <strong>{group.invite_code}</strong> — arkadaşların bu kodla
        katılabilir.
      </p>

      <div className="row" style={{ marginBottom: 20 }}>
        <Link href={`/group/${groupId}/vote`}><button>Oylama Yap</button></Link>
        <Link href={`/group/${groupId}/teams`}><button className="secondary">Takımları Oluştur</button></Link>
      </div>

      <h3>Üyeler ({members.length})</h3>
      <div className="card">
        <table>
          <thead>
            <tr><th>İsim</th><th>E-posta</th></tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}><td>{m.name}</td><td>{m.email}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Yetenek Puanları (ortalama)</h3>
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
            {ratings.map((r) => (
              <tr key={r.userId}>
                <td>{r.name}{!r.hasVotes && <span className="pill" style={{ marginLeft: 6 }}>oy yok</span>}</td>
                <td>{positionLabel(r.primaryPosition)}</td>
                <td>{positionLabel(r.secondaryPosition)}</td>
                {SKILLS.map((s) => <td key={s.key}>{r.skills[s.key]}</td>)}
                <td><strong>{r.overall}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
