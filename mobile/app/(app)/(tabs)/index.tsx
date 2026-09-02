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
import { Badge, Button, Card, ErrorText, ScoreBadge } from "../../../components/ui";
import { TeamSwitcher } from "../../../components/TeamSwitcher";
import { api, ApiError } from "../../../lib/api";
import { useActiveGroup } from "../../../lib/active-group";
import {
  clockTime,
  countdownLabel,
  dayNumber,
  monthAndDay,
  shortDate,
} from "../../../lib/format";
import { border, colors, radius, space, type } from "../../../lib/theme";

type UpcomingMatch = {
  id: string;
  groupId: string;
  groupName: string;
  scheduledAt: string;
  location: string | null;
  matchKind: string;
  format: string | null;
  requiredPlayers: number | null;
  attendingCount: number;
  attendingNames: string[];
  myAttendance: "yes" | "no" | null;
};

type HomeData = {
  scope: "all" | "group";
  group: { id: string; name: string; inviteCode: string } | null;
  groupCount: number;
  isOwner: boolean;
  upcomingMatches: UpcomingMatch[];
  monthStats: {
    played: number;
    wins: number;
    draws: number;
    losses: number;
    streak: number;
    recentResults: (string | null)[];
  };
  lastMatch: {
    id: string;
    groupId: string;
    groupName: string;
    scheduledAt: string;
    homeScore: number | null;
    awayScore: number | null;
    homeLabel: string | null;
    awayLabel: string | null;
    outcome: "win" | "draw" | "loss" | null;
    hasScore: boolean;
    mvp: { id: string; name: string; average: number } | null;
    ratingOpen: boolean;
    pendingRatings: number;
  } | null;
};

export default function HomeScreen() {
  const { scopeId, isAll, groups, loading: groupsLoading } = useActiveGroup();
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);

  // Kapsam degistiginde onceki istek hala ucuyor olabilir; gec donen eski
  // yanit yenisini ezmesin diye istegin kapsami ile guncel kapsam karsilastirilir.
  const scopeRef = useRef(scopeId);
  scopeRef.current = scopeId;

  const load = useCallback(async () => {
    const requested = scopeId;
    try {
      const query = requested ? `?groupId=${requested}` : "";
      const res = await api.get<HomeData>(`/api/home${query}`);
      if (scopeRef.current !== requested) return;
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

  // Mac olusturup geri donunce guncel gorunsun.
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

  async function setAttendance(match: UpcomingMatch, status: "yes" | "no") {
    setBusyMatchId(match.id);
    try {
      // Mac kendi takimina ait; "tum takimlar" gorunumunde de dogru adrese gider.
      await api.post(
        `/api/groups/${match.groupId}/matches/${match.id}/attendance`,
        { status }
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Yoklama kaydedilemedi.");
    } finally {
      setBusyMatchId(null);
    }
  }

  if (groupsLoading || (loading && !data)) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.pitch} />
      </View>
    );
  }

  if (groups.length === 0) {
    return (
      <View style={[s.center, { padding: space[6] }]}>
        <Text style={[type.displayS, { color: colors.ink, marginBottom: space[2] }]}>
          Henüz bir takımın yok
        </Text>
        <Text
          style={[
            type.bodyM,
            { color: colors.textSecondary, textAlign: "center", marginBottom: space[4] },
          ]}
        >
          Takımlarım sekmesinden yeni bir takım kurabilir ya da davet koduyla
          katılabilirsin.
        </Text>
        <Button title="Takımlarım" onPress={() => router.push("/groups")} />
      </View>
    );
  }

  const upcoming = data?.upcomingMatches ?? [];
  const stats = data?.monthStats;
  const last = data?.lastMatch ?? null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      contentContainerStyle={{
        paddingTop: insets.top + space[1],
        paddingHorizontal: space[4],
        paddingBottom: space[5],
        gap: space[4],
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Baslik + takim secici */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <TeamSwitcher />
        </View>
        <View style={s.avatar}>
          <Feather name="user" size={18} color={colors.ink100} />
        </View>
      </View>

      <ErrorText>{error}</ErrorText>

      {/* Yaklasan maclar — birden fazla takimda mac varsa hepsi listelenir */}
      {upcoming.length > 0 ? (
        upcoming.map((match) => (
          <MatchTicket
            key={match.id}
            match={match}
            showTeam={isAll}
            busy={busyMatchId === match.id}
            onAttend={(status) => setAttendance(match, status)}
          />
        ))
      ) : (
        <Card>
          <Text style={s.eyebrow}>SIRADAKİ MAÇ</Text>
          <Text
            style={[type.bodyM, { color: colors.textSecondary, marginTop: space[2] }]}
          >
            Planlanmış maç yok.
          </Text>
        </Card>
      )}

      {/* BU AY */}
      {stats && (
        <View style={{ gap: space[2] }}>
          <Text style={[s.eyebrow, { paddingHorizontal: 2 }]}>BU AY</Text>
          <View style={s.statsGrid}>
            <View style={s.statsCell}>
              <Text style={s.statsValue}>{stats.played}</Text>
              <Text style={s.eyebrow}>MAÇ</Text>
              <Text style={[type.bodyS, { color: colors.textSecondary }]}>
                {stats.wins}G · {stats.draws}B · {stats.losses}M
              </Text>
            </View>
            <View style={[s.statsCell, s.statsCellRight]}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                <Text style={[s.statsValue, { color: colors.amber700 }]}>
                  {stats.streak}
                </Text>
                <Text style={[type.scoreS, { color: colors.ink300 }]}>MAÇ</Text>
              </View>
              <Text style={s.eyebrow}>GALİBİYET SERİSİ</Text>
              <View style={{ flexDirection: "row", gap: 4 }}>
                {stats.recentResults.map((r, i) => (
                  <View
                    key={i}
                    style={[
                      s.resultSquare,
                      r === "win" && { backgroundColor: colors.pitch },
                      r === "draw" && { backgroundColor: colors.chalk300 },
                      r === "loss" && { backgroundColor: colors.ink100 },
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>
        </View>
      )}

      {/* SON MAC */}
      {last && (
        <View style={{ gap: space[2] }}>
          <Text style={[s.eyebrow, { paddingHorizontal: 2 }]}>
            SON MAÇ · {shortDate(last.scheduledAt)}
            {isAll ? ` · ${last.groupName}` : ""}
          </Text>
          <View style={s.lastCard}>
            <View style={s.lastHead}>
              <View style={{ gap: 5, flex: 1 }}>
                {last.outcome === "win" && <Badge tone="accent">Kazandın</Badge>}
                {last.outcome === "loss" && <Badge tone="neutral">Kaybettin</Badge>}
                {last.outcome === "draw" && <Badge tone="neutral">Berabere</Badge>}
                {last.outcome === null && <Badge tone="neutral">Takım içi</Badge>}
                <Text style={[type.bodyS, { color: colors.textSecondary }]}>
                  {last.homeLabel ?? "Bizim takım"}
                </Text>
              </View>
              {last.hasScore && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={s.bigScore}>{last.homeScore}</Text>
                  <Text style={[type.scoreM, { color: colors.ink300 }]}>–</Text>
                  <Text
                    style={[
                      s.bigScore,
                      last.outcome === "loss" && { color: colors.pitch900 },
                      last.outcome === "win" && { color: colors.ink300 },
                    ]}
                  >
                    {last.awayScore}
                  </Text>
                </View>
              )}
            </View>

            {last.mvp && (
              <View style={s.mvpRow}>
                <View style={s.avatarSmall}>
                  <Feather name="user" size={16} color={colors.ink100} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[type.bodyMMedium, { color: colors.ink }]}>
                      {last.mvp.name}
                    </Text>
                    <Text style={s.mvpTag}>MVP</Text>
                  </View>
                  <Text style={[type.bodyS, { color: colors.textSecondary }]}>
                    Maç ortalaması
                  </Text>
                </View>
                <ScoreBadge value={last.mvp.average} label="MAÇ" />
              </View>
            )}

            {last.ratingOpen && last.pendingRatings > 0 && (
              <Pressable
                onPress={() =>
                  router.push(`/group/${last.groupId}/match/${last.id}/rate`)
                }
                style={s.rateRow}
              >
                <Text style={[type.bodySMedium, { color: colors.textLink }]}>
                  Maçı oyla · {last.pendingRatings} oyuncu kaldı
                </Text>
                <Feather name="chevron-right" size={16} color={colors.pitch} />
              </Pressable>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// Bilet duzenindeki mac karti. Her yaklasan mac icin bir kez cizilir; boylece
// ayni anda birden fazla takimda maci olan oyuncu hepsine yoklama verebilir.
function MatchTicket({
  match,
  showTeam,
  busy,
  onAttend,
}: {
  match: UpcomingMatch;
  showTeam: boolean;
  busy: boolean;
  onAttend: (status: "yes" | "no") => void;
}) {
  const capacity = match.requiredPlayers;
  const fillPct =
    capacity && capacity > 0
      ? Math.min(100, Math.round((match.attendingCount / capacity) * 100))
      : 0;

  return (
    <View style={s.ticket}>
      <View style={s.ticketHead}>
        <Text style={s.eyebrow}>
          {showTeam ? `SIRADAKİ · ${match.groupName}` : "SIRADAKİ MAÇ"}
        </Text>
        <Badge tone="brand">{countdownLabel(match.scheduledAt)}</Badge>
      </View>

      <View style={s.scoreRow}>
        <View style={s.scoreCell}>
          <Text style={s.scoreValue}>{dayNumber(match.scheduledAt)}</Text>
          <Text style={s.eyebrow}>{monthAndDay(match.scheduledAt)}</Text>
        </View>
        <View style={[s.scoreCell, s.scoreCellMiddle]}>
          <Text style={s.scoreValue}>{clockTime(match.scheduledAt)}</Text>
          <Text style={s.eyebrow}>BAŞLAMA</Text>
        </View>
        <View style={s.scoreCell}>
          <Text style={s.scoreValue}>
            {match.format ?? (match.matchKind === "ic" ? "İÇ" : "DIŞ")}
          </Text>
          <Text style={s.eyebrow}>FORMAT</Text>
        </View>
      </View>

      {match.location ? (
        <View style={s.locationRow}>
          <Text style={[type.bodyMMedium, { color: colors.ink }]}>
            {match.location}
          </Text>
          <Text style={[type.bodyS, { color: colors.textSecondary }]}>
            {match.matchKind === "ic" ? "Takım içi maç" : "Dış rakip"}
          </Text>
        </View>
      ) : null}

      <View style={s.squadBlock}>
        <View style={s.squadHead}>
          <Text style={s.eyebrow}>KADRO</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 5 }}>
            <Text style={[type.scoreS, { color: colors.ink }]}>
              {match.attendingCount}
              {capacity ? `/${capacity}` : ""}
            </Text>
            <Text style={s.eyebrow}>KATILIYOR</Text>
          </View>
        </View>

        {match.attendingNames.length > 0 && (
          <Text style={[type.bodyS, { color: colors.textSecondary }]}>
            {match.attendingNames.join(", ")}
            {match.attendingCount > match.attendingNames.length
              ? ` +${match.attendingCount - match.attendingNames.length}`
              : ""}
          </Text>
        )}

        {capacity ? (
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${fillPct}%` }]} />
          </View>
        ) : null}
      </View>

      <View style={s.ctaBlock}>
        {match.myAttendance === "yes" ? (
          <>
            <Button
              title="✓ Katılıyorsun · Vazgeç"
              variant="secondary"
              loading={busy}
              onPress={() => onAttend("no")}
            />
            <Text style={s.ctaHelper}>
              Kadroda {match.attendingCount}. sıradasın.
            </Text>
          </>
        ) : (
          <>
            <Button
              title={match.myAttendance === "no" ? "Fikrimi değiştirdim" : "Katılıyorum"}
              loading={busy}
              onPress={() => onAttend("yes")}
            />
            <Text style={s.ctaHelper}>
              {match.myAttendance === "no"
                ? "Şu an katılmıyor görünüyorsun."
                : "Yoklama maç saatine kadar açık."}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const s = {
  center: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: colors.surfacePage,
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    justifyContent: "space-between" as const,
    gap: space[3],
  },
  teamRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    marginTop: 3,
  },
  eyebrow: {
    ...type.labelS,
    textTransform: "uppercase" as const,
    color: colors.ink300,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.chalk200,
    borderWidth: border.width,
    borderColor: colors.borderDefault,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  avatarSmall: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.chalk200,
    borderWidth: border.width,
    borderColor: colors.borderDefault,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  switcherRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },

  // Bilet kartI: govde beyaz, kenarlik kalin, bolmeler hairline.
  ticket: {
    backgroundColor: colors.surfaceCardRaised,
    borderWidth: border.widthThick,
    borderColor: colors.borderStrong,
    borderRadius: radius.card,
    overflow: "hidden" as const,
  },
  ticketHead: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: space[3] + 2,
    paddingVertical: space[3] - 1,
    borderBottomWidth: border.width,
    borderBottomColor: colors.borderDefault,
  },
  scoreRow: { flexDirection: "row" as const },
  scoreCell: {
    flex: 1,
    alignItems: "center" as const,
    gap: 5,
    paddingVertical: space[4],
    paddingHorizontal: space[2],
  },
  scoreCellMiddle: {
    borderLeftWidth: border.width,
    borderRightWidth: border.width,
    borderColor: colors.borderDefault,
  },
  scoreValue: {
    ...type.scoreL,
    color: colors.pitch900,
  },
  locationRow: {
    gap: 2,
    paddingHorizontal: space[3] + 2,
    paddingVertical: space[3],
    borderTopWidth: border.width,
    borderBottomWidth: border.width,
    borderColor: colors.borderDefault,
    backgroundColor: colors.chalk100,
  },
  squadBlock: {
    paddingHorizontal: space[3] + 2,
    paddingTop: space[3] + 1,
    paddingBottom: space[3] + 2,
    gap: space[2] + 2,
  },
  squadHead: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  progressTrack: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.chalk300,
    overflow: "hidden" as const,
  },
  progressFill: {
    height: "100%" as const,
    borderRadius: radius.pill,
    backgroundColor: colors.pitch,
  },
  ctaBlock: {
    paddingHorizontal: space[3] + 2,
    paddingBottom: space[3] + 2,
    gap: space[2],
  },
  ctaHelper: {
    ...type.bodyS,
    color: colors.textSecondary,
    textAlign: "center" as const,
  },

  statsGrid: {
    flexDirection: "row" as const,
    backgroundColor: colors.surfaceCard,
    borderWidth: border.width,
    borderColor: colors.borderDefault,
    borderRadius: radius.card,
    overflow: "hidden" as const,
  },
  statsCell: {
    flex: 1,
    padding: space[3] + 2,
    gap: 6,
  },
  statsCellRight: {
    borderLeftWidth: border.width,
    borderLeftColor: colors.borderDefault,
  },
  statsValue: {
    ...type.scoreL,
    color: colors.pitch900,
  },
  resultSquare: {
    width: 15,
    height: 15,
    borderRadius: 4,
    backgroundColor: colors.chalk300,
  },

  lastCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: border.width,
    borderColor: colors.borderDefault,
    borderRadius: radius.card,
    overflow: "hidden" as const,
  },
  lastHead: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: space[2],
    padding: space[3] + 2,
  },
  bigScore: {
    ...type.scoreL,
    color: colors.pitch900,
  },
  mvpRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: space[2] + 2,
    paddingHorizontal: space[3] + 2,
    paddingVertical: space[3] - 1,
    borderTopWidth: border.width,
    borderTopColor: colors.borderDefault,
    backgroundColor: colors.chalk100,
  },
  mvpTag: {
    ...type.labelS,
    color: colors.amber700,
    backgroundColor: colors.amber100,
    borderRadius: radius.pill,
    paddingHorizontal: space[2],
    paddingVertical: 3,
    overflow: "hidden" as const,
  },
  rateRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: space[3] + 2,
    paddingVertical: space[3],
    borderTopWidth: border.width,
    borderTopColor: colors.borderDefault,
  },
};
