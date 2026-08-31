import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { Button, Card, ErrorText, Screen } from "../../../../components/ui";
import { api, ApiError } from "../../../../lib/api";
import { positionLabel } from "../../../../lib/constants";
import { colors } from "../../../../lib/theme";

type Group = { id: string; name: string; invite_code: string; owner_id: string };
type Member = { id: string; name: string; email: string };
type Rating = {
  userId: string;
  name: string;
  overall: number;
  voteCount: number;
  hasVotes: boolean;
  primaryPosition: string | null;
  secondaryPosition: string | null;
};

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [groupData, ratingsData] = await Promise.all([
        api.get<{ group: Group; members: Member[]; isOwner: boolean }>(`/api/groups/${id}`),
        api.get<{ ratings: Rating[] }>(`/api/groups/${id}/ratings`),
      ]);
      setGroup(groupData.group);
      setMembers(groupData.members);
      setIsOwner(groupData.isOwner);
      setRatings(ratingsData.ratings);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Takım yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const ratingByUser = new Map(ratings.map((r) => [r.userId, r]));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Screen>
        <ErrorText>{error}</ErrorText>

        {group && (
          <Card>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
              {group.name}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 4 }}>
              Davet kodu: {group.invite_code}
              {isOwner ? " · Yöneticisin" : ""}
            </Text>
          </Card>
        )}

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Button title="Oylama Yap" onPress={() => router.push(`/group/${id}/vote`)} />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Button
              title="Takımları Oluştur"
              variant="secondary"
              onPress={() => router.push(`/group/${id}/teams`)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Puan Detayı"
              variant="secondary"
              onPress={() => router.push(`/group/${id}/breakdown`)}
            />
          </View>
        </View>

        <Text style={{ fontWeight: "700", marginBottom: 8, color: colors.text }}>
          Üyeler ({members.length})
        </Text>
        {loading && (
          <View style={{ paddingVertical: 20 }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
        {members.map((m) => {
          const r = ratingByUser.get(m.id);
          return (
            <Card key={m.id}>
              <Text style={{ fontWeight: "600", color: colors.text }}>{m.name}</Text>
              <Text style={{ color: colors.muted, marginTop: 2 }}>
                {r?.hasVotes
                  ? `Güç: ${r.overall} · ${positionLabel(r.primaryPosition)} / ${positionLabel(
                      r.secondaryPosition
                    )} · ${r.voteCount} oy`
                  : "Henüz oy almadı"}
              </Text>
            </Card>
          );
        })}
      </Screen>
    </ScrollView>
  );
}
