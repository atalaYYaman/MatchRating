import Slider from "@react-native-community/slider";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Button, Card, ErrorText, Screen } from "../../../../components/ui";
import { api, ApiError } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";
import { MAX_SCORE, MIN_SCORE, POSITIONS, PositionKey, SKILLS, SkillKey } from "../../../../lib/constants";
import { colors } from "../../../../lib/theme";

type Member = { id: string; name: string };
type PositionVoteRow = { target_id: string };

const initialScores = () =>
  Object.fromEntries(SKILLS.map((s) => [s.key, 75])) as Record<SkillKey, number>;

export default function VoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [members, setMembers] = useState<Member[]>([]);
  const [votedTargetIds, setVotedTargetIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [target, setTarget] = useState<Member | null>(null);
  const [scores, setScores] = useState<Record<SkillKey, number>>(initialScores());
  const [primary, setPrimary] = useState<PositionKey | null>(null);
  const [secondary, setSecondary] = useState<PositionKey | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [groupData, voteData] = await Promise.all([
        api.get<{ members: Member[] }>(`/api/groups/${id}`),
        api.get<{ positionVotes: PositionVoteRow[] }>(`/api/groups/${id}/vote`),
      ]);
      setMembers(groupData.members.filter((m) => m.id !== user?.id));
      setVotedTargetIds(new Set(voteData.positionVotes.map((v) => v.target_id)));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  function openTarget(m: Member) {
    setTarget(m);
    setScores(initialScores());
    setPrimary(null);
    setSecondary(null);
    setError(null);
  }

  function selectPosition(key: PositionKey) {
    if (primary === key) {
      setPrimary(secondary);
      setSecondary(null);
      return;
    }
    if (secondary === key) {
      setSecondary(null);
      return;
    }
    if (!primary) {
      setPrimary(key);
    } else if (!secondary) {
      setSecondary(key);
    } else {
      setSecondary(key);
    }
  }

  async function submit() {
    if (!target || !primary || !secondary) {
      setError("Birincil ve ikincil mevki seçmelisin.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/groups/${id}/vote`, {
        targetId: target.id,
        scores,
        primaryPosition: primary,
        secondaryPosition: secondary,
      });
      setTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Oy kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  if (target) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
        <Screen>
          <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 12, color: colors.textPrimary }}>
            {target.name} için oy ver
          </Text>
          <ErrorText>{error}</ErrorText>

          <Card>
            {SKILLS.map((s) => (
              <View key={s.key} style={{ marginBottom: 14 }}>
                <Text style={{ color: colors.textPrimary, marginBottom: 4 }}>
                  {s.label}: {scores[s.key]}
                </Text>
                <Slider
                  minimumValue={MIN_SCORE}
                  maximumValue={MAX_SCORE}
                  step={1}
                  value={scores[s.key]}
                  onValueChange={(v) => setScores((prev) => ({ ...prev, [s.key]: v }))}
                  minimumTrackTintColor={colors.pitch}
                />
              </View>
            ))}
          </Card>

          <Card>
            <Text style={{ fontWeight: "600", marginBottom: 8, color: colors.textPrimary }}>
              Mevki (önce birincil, sonra ikincil seç)
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {POSITIONS.map((p) => {
                const isPrimary = primary === p.key;
                const isSecondary = secondary === p.key;
                return (
                  <Pressable
                    key={p.key}
                    onPress={() => selectPosition(p.key)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: isPrimary || isSecondary ? colors.pitch : colors.borderDefault,
                      backgroundColor: isPrimary
                        ? colors.pitch
                        : isSecondary
                        ? "#DCFCE7"
                        : "#fff",
                    }}
                  >
                    <Text style={{ color: isPrimary ? "#fff" : colors.textPrimary, fontSize: 13 }}>
                      {p.label}
                      {isPrimary ? " (1.)" : isSecondary ? " (2.)" : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Button title="Oyu kaydet" onPress={submit} loading={saving} />
          <View style={{ height: 8 }} />
          <Button title="Vazgeç" variant="secondary" onPress={() => setTarget(null)} />
        </Screen>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <Screen>
        <ErrorText>{error}</ErrorText>
        <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>
          Bir üyeye dokunarak yetenek ve mevki oyu ver. Daha önce oy verdiklerini tekrar
          düzenleyebilirsin.
        </Text>
        {!loading && members.length === 0 && (
          <Text style={{ color: colors.textSecondary }}>Oy verebileceğin başka üye yok.</Text>
        )}
        {members.map((m) => {
          const voted = votedTargetIds.has(m.id);
          return (
            <Pressable key={m.id} onPress={() => openTarget(m)}>
              <Card>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontWeight: "600", color: colors.textPrimary }}>{m.name}</Text>
                  <Text style={{ color: voted ? colors.pitch : colors.textSecondary, fontSize: 13 }}>
                    {voted ? "Oy verildi ✓" : "Oy ver"}
                  </Text>
                </View>
              </Card>
            </Pressable>
          );
        })}
      </Screen>
    </ScrollView>
  );
}
