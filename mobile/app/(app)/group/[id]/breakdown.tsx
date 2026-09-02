import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Switch, Text, View } from "react-native";
import { Card, ErrorText, Screen } from "../../../../components/ui";
import { api, ApiError } from "../../../../lib/api";
import { SKILLS } from "../../../../lib/constants";
import { colors } from "../../../../lib/theme";

type SkillBreakdown = {
  average: number | null;
  voteCount: number;
  votes: { voterId: string; voterName: string; score: number }[];
};
type PlayerBreakdown = {
  userId: string;
  name: string;
  voteCount: number;
  skills: Record<string, SkillBreakdown>;
};

export default function BreakdownScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [players, setPlayers] = useState<PlayerBreakdown[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{
        players: PlayerBreakdown[];
        isOwner: boolean;
        ratingsBreakdownPublic: boolean;
      }>(`/api/groups/${id}/breakdown`);
      setPlayers(data.players);
      setIsOwner(data.isOwner);
      setIsPublic(data.ratingsBreakdownPublic);
      setForbidden(false);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
      } else {
        setError(err instanceof ApiError ? err.message : "Yüklenemedi.");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function togglePublic(value: boolean) {
    setToggling(true);
    try {
      await api.patch(`/api/groups/${id}/breakdown`, { public: value });
      setIsPublic(value);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ayar değiştirilemedi.");
    } finally {
      setToggling(false);
    }
  }

  if (forbidden) {
    return (
      <Screen>
        <Card>
          <Text style={{ color: colors.textSecondary }}>
            Puan detayları şu an sadece yöneticiye açık.
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <Screen>
        <ErrorText>{error}</ErrorText>

        {loading && (
          <View style={{ paddingVertical: 20 }}>
            <ActivityIndicator color={colors.pitch} />
          </View>
        )}

        {isOwner && (
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
                Puan detayları herkese açık
              </Text>
              <Switch value={isPublic} onValueChange={togglePublic} disabled={toggling} />
            </View>
          </Card>
        )}

        {players.map((p) => (
          <Card key={p.userId}>
            <Text style={{ fontWeight: "700", color: colors.textPrimary, marginBottom: 6 }}>
              {p.name} ({p.voteCount} oy)
            </Text>
            {SKILLS.map((s) => {
              const b = p.skills[s.key];
              if (!b || b.voteCount === 0) return null;
              return (
                <View key={s.key} style={{ marginTop: 6 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600" }}>
                    {s.label}: {b.average}
                  </Text>
                  {b.votes.map((v) => (
                    <Text key={v.voterId} style={{ color: colors.textSecondary, fontSize: 12 }}>
                      {v.voterName}: {v.score}
                    </Text>
                  ))}
                </View>
              );
            })}
          </Card>
        ))}
      </Screen>
    </ScrollView>
  );
}
