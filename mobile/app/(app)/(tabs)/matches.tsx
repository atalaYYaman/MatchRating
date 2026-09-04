import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
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
import { TeamSwitcher } from "../../../components/TeamSwitcher";
import { api, ApiError } from "../../../lib/api";
import { useActiveGroup } from "../../../lib/active-group";
import { useAuth } from "../../../lib/auth-context";
import { clockTime, countdownLabel, shortDate } from "../../../lib/format";
import { MatchPhase, PHASE_LABEL, PHASE_TONE } from "../../../lib/constants";
import { border, colors, radius, space, type } from "../../../lib/theme";

type MatchRow = {
  id: string;
  group_id: string;
  group_name: string;
  isOwner: boolean;
  mode: "poll" | "fixed";
  match_kind: "ic" | "dis";
  scheduled_at: string | null;
  location: string | null;
  status: "poll_open" | "scheduled" | "completed" | "cancelled";
  phase: MatchPhase;
  attending_count: number;
  poll_response_count: number;
  /** Senden bekleneni anlatir; amber sinyalin kaynagi. */
  myAction: "poll" | "rsvp" | "rating" | null;
};

const ACTION_LABEL: Record<"poll" | "rsvp" | "rating", string> = {
  poll: "Anketi cevapla",
  rsvp: "Katılım bildir",
  rating: "Maçı puanla",
};

// Dort cip yeter: hepsi, senden bir sey beklenenler, gelecek, gecmis.
const FILTERS = [
  { key: "all", label: "Tümü", phases: null },
  { key: "rating", label: "Puanlanıyor", phases: ["rating"] },
  { key: "upcoming", label: "Yaklaşan", phases: ["poll", "scheduled", "playing"] },
  { key: "past", label: "Tamamlandı", phases: ["completed", "cancelled"] },
] as const;

export default function MatchesScreen() {
  const { activeGroup, isAll, scopeId, groups } = useActiveGroup();
  const insets = useSafeAreaInsets();

  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  // Kapsam degistiginde onceki istek hala ucuyor olabilir; gec donen eski
  // yanit yenisini ezmesin diye istegin kapsami ile guncel kapsam karsilastirilir.
  const scopeRef = useRef(scopeId);
  scopeRef.current = scopeId;

  const load = useCallback(async () => {
    const requested = scopeId;
    try {
      const query = requested ? `?groupId=${requested}` : "";
      const data = await api.get<{ matches: MatchRow[] }>(`/api/matches${query}`);
      if (scopeRef.current !== requested) return;
      setMatches(data.matches);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Maçlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

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

  // "Tüm takımlar" gorunumunde hedef belirsiz: tek takimi olan kullanici icin
  // o takim varsayilir, birden fazlaysa buton gizlenir.
  const newMatchTarget = activeGroup ?? (groups.length === 1 ? groups[0] : null);

  const activeFilter = FILTERS.find((f) => f.key === filter);
  const visible = activeFilter?.phases
    ? matches.filter((m) =>
        (activeFilter.phases as readonly string[]).includes(m.phase)
      )
    : matches;

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
      <TeamSwitcher eyebrow="MAÇLAR · TAKIM" />

      <ErrorText>{error}</ErrorText>

      {newMatchTarget && (
        <Button
          title="Yeni maç oluştur"
          onPress={() => router.push(`/group/${newMatchTarget.id}/match/new`)}
        />
      )}

      <View style={s.filterRow}>
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[s.filterChip, on && s.filterChipOn]}
            >
              <Text
                style={[
                  type.bodySMedium,
                  { color: on ? colors.textOnBrand : colors.ink },
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading && (
        <View style={{ paddingVertical: space[8] }}>
          <ActivityIndicator color={colors.pitch} />
        </View>
      )}

      {!loading && visible.length === 0 && (
        <Card>
          <Text style={[type.bodyM, { color: colors.textSecondary }]}>
            {isAll
              ? "Takımlarının hiçbirinde henüz maç yok."
              : "Bu takımda henüz maç yok."}
          </Text>
        </Card>
      )}

      {visible.map((m) => {
        const upcoming =
          m.scheduled_at && new Date(m.scheduled_at).getTime() > Date.now();
        return (
          <Pressable
            key={m.id}
            onPress={() => router.push(`/group/${m.group_id}/match/${m.id}`)}
          >
            <View style={[s.card, m.myAction ? s.cardNeedsAction : null]}>
              <View style={s.head}>
                <View style={{ flexDirection: "row", gap: space[2], flexShrink: 1 }}>
                  <Badge tone={PHASE_TONE[m.phase]}>{PHASE_LABEL[m.phase]}</Badge>
                  {m.myAction && <Badge tone="accent">{ACTION_LABEL[m.myAction]}</Badge>}
                </View>
                <Text style={[type.bodyS, { color: colors.textTertiary }]}>
                  {isAll ? `${m.group_name} · ` : ""}
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
  // Amber tek bir sey icin ayrildi: senden bir sey bekleniyor.
  cardNeedsAction: {
    borderLeftWidth: 3,
    borderLeftColor: colors.amber,
  },
  filterRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: space[2],
  },
  filterChip: {
    minHeight: 44,
    justifyContent: "center" as const,
    paddingVertical: space[2],
    paddingHorizontal: space[4],
    borderRadius: radius.pill,
    borderWidth: border.width,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surfaceCard,
  },
  filterChipOn: {
    backgroundColor: colors.pitch,
    borderColor: colors.pitch,
  },
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
