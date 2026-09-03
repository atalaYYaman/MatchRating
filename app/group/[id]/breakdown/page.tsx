"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge, Card, ErrorText, Eyebrow, InlineMessage } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";
import { SKILLS } from "@/lib/skills";
import { positionLabel } from "@/lib/positions";

type SkillVoteDetail = { voterId: string; voterName: string; score: number };
type PositionVoteDetail = {
  voterId: string;
  voterName: string;
  primary: string;
  secondary: string;
};
type SkillBreakdown = {
  average: number | null;
  voteCount: number;
  votes: SkillVoteDetail[];
};
type PlayerBreakdown = {
  userId: string;
  name: string;
  voteCount: number;
  skills: Record<string, SkillBreakdown>;
  positions: PositionVoteDetail[];
};

export default function BreakdownPage() {
  const params = useParams<{ id: string }>();
  const groupId = params.id;

  const [players, setPlayers] = useState<PlayerBreakdown[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get<{
        players: PlayerBreakdown[];
        isOwner: boolean;
        ratingsBreakdownPublic: boolean;
      }>(`/api/groups/${groupId}/breakdown`);
      setPlayers(data.players ?? []);
      setIsOwner(Boolean(data.isOwner));
      setIsPublic(Boolean(data.ratingsBreakdownPublic));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Puan detayları yüklenemedi."
      );
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  async function togglePublic() {
    setToggling(true);
    setActionError(null);
    try {
      const data = await api.patch<{ ratingsBreakdownPublic: boolean }>(
        `/api/groups/${groupId}/breakdown`,
        { public: !isPublic }
      );
      setIsPublic(Boolean(data.ratingsBreakdownPublic));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Ayar kaydedilemedi.");
    } finally {
      setToggling(false);
    }
  }

  if (loading) return <p className="muted">Yükleniyor...</p>;

  return (
    <div>
      <p>
        <Link href={`/group/${groupId}`}>← Takıma dön</Link>
      </p>
      <h1>Puan Detayları</h1>
      <p className="muted" style={{ marginTop: 4 }}>
        Her oyuncunun aldığı oyların kimden geldiğini gösterir.
      </p>

      {isOwner && (
        <Card>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="grow">
              <Eyebrow>GÖRÜNÜRLÜK</Eyebrow>
              <p className="muted" style={{ margin: "6px 0 0" }}>
                {isPublic
                  ? "Detaylar takımdaki herkese açık."
                  : "Detayları şu an yalnızca sen görüyorsun."}
              </p>
            </div>
            <button
              className={isPublic ? "secondary" : undefined}
              onClick={togglePublic}
              disabled={toggling}
            >
              {isPublic ? "Gizle" : "Herkese aç"}
            </button>
          </div>
          <ErrorText>{actionError}</ErrorText>
        </Card>
      )}

      {error && <InlineMessage tone="danger">{error}</InlineMessage>}

      {!error && players.length === 0 && (
        <Card>
          <p className="muted" style={{ margin: 0 }}>
            Henüz oy verilmemiş.
          </p>
        </Card>
      )}

      {players.map((p) => {
        const open = openId === p.userId;
        return (
          <Card key={p.userId} raised={open}>
            <button
              type="button"
              className="disclosure"
              onClick={() => setOpenId(open ? null : p.userId)}
              aria-expanded={open}
            >
              <span className="grow">
                {p.name}{" "}
                <Badge tone={p.voteCount > 0 ? "brand" : "neutral"}>
                  {p.voteCount} oy
                </Badge>
              </span>
              <span aria-hidden="true">{open ? "−" : "+"}</span>
            </button>

            {open && (
              <div style={{ marginTop: 4 }}>
                {p.voteCount === 0 && (
                  <p className="muted">Bu oyuncuya henüz oy verilmemiş.</p>
                )}

                {SKILLS.map((s) => {
                  const b = p.skills[s.key];
                  if (!b || b.voteCount === 0) return null;
                  return (
                    <div
                      key={s.key}
                      style={{
                        paddingTop: 14,
                        marginTop: 14,
                        borderTop: "1px solid var(--border-default)",
                      }}
                    >
                      <div className="skill-line">
                        <Eyebrow>{s.label}</Eyebrow>
                        <span className="skill-avg">{b.average}</span>
                      </div>
                      <div className="voters">
                        {b.votes.map((v) => (
                          <div key={v.voterId} className="voter-row">
                            <span>{v.voterName}</span>
                            <span className="voter-score">{v.score}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {p.positions.length > 0 && (
                  <div
                    style={{
                      paddingTop: 14,
                      marginTop: 14,
                      borderTop: "1px solid var(--border-default)",
                    }}
                  >
                    <div className="skill-line">
                      <Eyebrow>MEVKİ OYLARI</Eyebrow>
                      <span className="muted">{p.positions.length} oy</span>
                    </div>
                    <div className="voters">
                      {p.positions.map((v) => (
                        <div key={v.voterId} className="voter-row">
                          <span>{v.voterName}</span>
                          <span>
                            {positionLabel(v.primary)} / {positionLabel(v.secondary)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
