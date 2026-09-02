import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Badge, Button, Card, ErrorText } from "../../../components/ui";
import { api, ApiError } from "../../../lib/api";
import { useActiveGroup } from "../../../lib/active-group";
import { useAuth } from "../../../lib/auth-context";
import { clockTime, countdownLabel, shortDate } from "../../../lib/format";
import { border, colors, radius, space, type } from "../../../lib/theme";

type MatchRow = {
  id: string;
  mode: "poll" | "fixed";
  match_kind: "ic" | "dis";
  scheduled_at: string | null;
  location: string | null;
  status: "poll_open" | "scheduled" | "completed" | "cancelled";
  attending_count: number;
  poll_response_count: number;
};

const STATUS: Record<
  MatchRow["status"],
  { label: string; tone: "neutral" | "brand" | "accent" | "danger" }
> = {
  poll_open: { label: "Anket açık", tone: "accent" },
  scheduled: { label: "Planlandı", tone: "brand" },
  completed: { label: "Tamamlandı", tone: "neutral" },
  cancelled: { label: "İptal", tone: "danger" },
};

export default function MatchesScreen() {
  const { activeGroup } = useActiveGroup();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeGroup) {
      setMatches([]);
      setLoading(false);
      return;
    }
    try {
      const data = await api.get<{ matches: MatchRow[] }>(
        `/api/groups/${activeGroup.id}/matches`
      );
      setMatches(data.matches);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Maçlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [activeGroup]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const isOwner = activeGroup?.owner_id === user?.id;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      contentContainerStyle={{
        paddingTop: insets.top + space[2],
        paddingHorizontal: space[4],
        paddingBottom: space[5],
        gap: space[3],
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View>
        <Text style={s.eyebrow}>{activeGroup?.name ?? "TAKIM SEÇİLMEDİ"}</Text>
        <Text style={[type.displayM, { color: colors.ink, marginTop: 2 }]}>Maçlar</Text>
      </View>

      <ErrorText>{error}</ErrorText>

      {isOwner && activeGroup && (
        <Button
          title="Yeni maç oluştur"
          onPress={() => router.push(`/group/${activeGroup.id}/match/new`)}
        />
      )}

      {loading && (
        <View style={{ paddingVertical: space[8] }}>
          <ActivityIndicator color={colors.pitch} />
        </View>
      )}

      {!loading && matches.length === 0 && (
        <Card>
          <Text style={[type.bodyM, { color: colors.textSecondary }]}>
            {activeGroup
              ? "Bu takımda henüz maç yok."
              : "Önce Takımlarım sekmesinden bir takım seç."}
          </Text>
        </Card>
      )}

      {matches.map((m) => {
        const status = STATUS[m.status];
        const upcoming =
          m.scheduled_at && new Date(m.scheduled_at).getTime() > Date.now();
        return (
          <Pressable
            key={m.id}
            onPress={() =>
              activeGroup && router.push(`/group/${activeGroup.id}/match/${m.id}`)
            }
          >
            <View style={s.card}>
              <View style={s.head}>
                <Badge tone={status.tone}>{status.label}</Badge>
                <Text style={[type.bodyS, { color: colors.textTertiary }]}>
                  {m.match_kind === "ic" ? "Takım içi" : "Dış rakip"}
                </Text>
              </View>

              {m.scheduled_at ? (
                <View style={{ gap: 2 }}>
                  <Text style={[type.displayS, { color: colors.ink }]}>
                    {shortDate(m.scheduled_at)} · {clockTime(m.scheduled_at)}
                  </Text>
                  {m.location ? (
                    <Text style={[type.bodyS, { color: colors.textSecondary }]}>
                      {m.location}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text style={[type.displayS, { color: colors.ink }]}>
                  Tarih anketi sürüyor
                </Text>
              )}

              <View style={s.foot}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Feather name="users" size={14} color={colors.ink300} />
                  <Text style={[type.bodyS, { color: colors.textSecondary }]}>
                    {m.status === "poll_open"
                      ? `${m.poll_response_count} cevap`
                      : `${m.attending_count} katılıyor`}
                  </Text>
                </View>
                {upcoming && m.scheduled_at ? (
                  <Text style={[type.bodySMedium, { color: colors.textLink }]}>
                    {countdownLabel(m.scheduled_at)}
                  </Text>
                ) : null}
              </View>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = {
  eyebrow: {
    ...type.labelS,
    textTransform: "uppercase" as const,
    color: colors.ink300,
  },
  card: {
    backgroundColor: colors.surfaceCard,
    borderWidth: border.width,
    borderColor: colors.borderDefault,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[3],
  },
  head: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  foot: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    borderTopWidth: border.width,
    borderTopColor: colors.borderDefault,
    paddingTop: space[3],
  },
};
