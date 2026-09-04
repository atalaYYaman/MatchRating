import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { Badge, Card, ErrorText, Label, ScoreBadge } from "../../components/ui";
import { TeamSwitcher } from "../../components/TeamSwitcher";
import { api, ApiError } from "../../lib/api";
import { useActiveGroup } from "../../lib/active-group";
import { shortDate } from "../../lib/format";
import { SKILLS } from "../../lib/constants";
import { border, colors, space, type } from "../../lib/theme";

type RatingPoint = { matchId: string | null; at: string; overall: number; delta: number };
type TimelineEntry = {
  matchId: string;
  groupId: string;
  groupName: string;
  at: string;
  netDelta: number;
  performanceDelta: number;
  penaltyDelta: number;
  matchAverage: number | null;
};
type GroupJourney = {
  groupId: string;
  groupName: string;
  startOverall: number;
  currentOverall: number;
  netDelta: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: RatingPoint[];
};
type Companion = { key: string; name: string; isGuest: boolean; count: number };
type Career = {
  groups: GroupJourney[];
  timeline: TimelineEntry[];
  totals: { played: number; wins: number; draws: number; losses: number };
  matchRatings: { count: number; average: number | null; best: number | null };
  strengths: { skill: string; count: number }[];
  weaknesses: { skill: string; count: number }[];
  wonWith: Companion[];
  lostTo: Companion[];
};

function skillLabel(key: string) {
  return SKILLS.find((s) => s.key === key)?.label ?? key;
}
function signed(value: number) {
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}

export default function CareerScreen() {
  const { scopeId, isAll } = useActiveGroup();
  const [career, setCareer] = useState<Career | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Kapsam degisince eski istegin gec gelen cevabi yeniyi ezmesin.
  const scopeRef = useRef<string | null>(scopeId);

  const load = useCallback(async () => {
    const requested = scopeId;
    scopeRef.current = requested;
    try {
      const query = requested ? `?groupId=${requested}` : "";
      const data = await api.get<{ career: Career }>(`/api/career${query}`);
      if (scopeRef.current !== requested) return;
      setCareer(data.career);
      setError(null);
    } catch (err) {
      if (scopeRef.current !== requested) return;
      setError(err instanceof ApiError ? err.message : "Kariyer yüklenemedi.");
    } finally {
      if (scopeRef.current === requested) setLoading(false);
    }
  }, [scopeId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const totals = career?.totals;
  const winRate =
    totals && totals.played > 0 ? Math.round((totals.wins / totals.played) * 100) : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      contentContainerStyle={{ padding: space[4], gap: space[3] }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <TeamSwitcher eyebrow="KARİYER · TAKIM" />

      <Text style={[type.displayM, { color: colors.ink }]}>Kariyerim</Text>
      <Text style={[type.bodyS, { color: colors.textSecondary }]}>
        {isAll
          ? "Tüm takımlarındaki gelişimin, maç puanların ve birlikte oynadığın kişiler."
          : "Bu takımdaki gelişimin, maç puanların ve birlikte oynadığın kişiler."}
      </Text>

      <ErrorText>{error}</ErrorText>

      {loading && (
        <View style={{ paddingVertical: 24 }}>
          <ActivityIndicator color={colors.pitch} />
        </View>
      )}

      {career && !loading && (
        <>
          <Card raised>
            <Label>Özet</Label>
            <View style={s.statRow}>
              <Stat label="MAÇ" value={totals?.played ?? 0} />
              <Stat
                label="G-B-M"
                value={`${totals?.wins ?? 0}-${totals?.draws ?? 0}-${totals?.losses ?? 0}`}
              />
              {winRate !== null && <Stat label="KAZANMA" value={`%${winRate}`} />}
            </View>
            {career.matchRatings.count > 0 && (
              <View style={[s.statRow, { marginTop: space[4] }]}>
                <Stat label="ORT. PUAN" value={career.matchRatings.average ?? "—"} />
                <Stat label="EN İYİ" value={career.matchRatings.best ?? "—"} />
                <Stat label="ALDIĞIN OY" value={career.matchRatings.count} />
              </View>
            )}
          </Card>

          {career.totals.played === 0 && career.timeline.length === 0 && (
            <Card>
              <Text style={[type.bodyM, { color: colors.textSecondary }]}>
                Henüz puanlanmış bir maçın yok. İlk maçından sonra kariyer özetin burada
                oluşmaya başlayacak.
              </Text>
            </Card>
          )}

          {career.groups.map((g) => (
            <Card key={g.groupId}>
              <View style={s.head}>
                <Text style={[type.bodyMMedium, { color: colors.ink }]}>{g.groupName}</Text>
                <Badge tone={g.netDelta > 0 ? "brand" : g.netDelta < 0 ? "danger" : "neutral"}>
                  {signed(g.netDelta)}
                </Badge>
              </View>

              <View style={[s.head, { marginTop: space[3] }]}>
                <View style={{ alignItems: "center" }}>
                  <Text style={[type.bodyS, { color: colors.textTertiary }]}>BAŞLANGIÇ</Text>
                  <Text style={[type.scoreM, { color: colors.ink300 }]}>{g.startOverall}</Text>
                </View>
                <Text style={[type.bodyM, { color: colors.textTertiary }]}>→</Text>
                <View style={{ alignItems: "center" }}>
                  <Text style={[type.bodyS, { color: colors.textTertiary }]}>ŞİMDİ</Text>
                  <Text style={[type.scoreM, { color: colors.pitch900 }]}>
                    {g.currentOverall}
                  </Text>
                </View>
                <ScoreBadge value={`${g.wins}-${g.draws}-${g.losses}`} label="G-B-M" />
              </View>

              {g.points.length > 1 && <Sparkline points={g.points} />}
            </Card>
          ))}

          {career.strengths.length > 0 && (
            <Card>
              <Text style={[type.bodyS, { color: colors.textSecondary }]}>
                Takım arkadaşların seni en çok bu yönünle övdü
              </Text>
              <Text style={[type.displayS, { color: colors.ink, marginTop: 4 }]}>
                {skillLabel(career.strengths[0].skill)}
              </Text>
              <Text style={[type.bodyS, { color: colors.textSecondary }]}>
                {career.strengths[0].count} maçta öne çıkan yönün seçildi
              </Text>
              {career.weaknesses.length > 0 && (
                <Text
                  style={[type.bodyS, { color: colors.textSecondary, marginTop: space[3] }]}
                >
                  En çok geliştirmen istenen yön:{" "}
                  {skillLabel(career.weaknesses[0].skill)} ({career.weaknesses[0].count} maç)
                </Text>
              )}
            </Card>
          )}

          {career.wonWith.length > 0 && (
            <Card>
              <Label>Uğurlu takım arkadaşların</Label>
              <Text
                style={[type.bodyS, { color: colors.textSecondary, marginBottom: space[2] }]}
              >
                Aynı takımda oynayıp en çok birlikte kazandığın kişiler.
              </Text>
              {career.wonWith.map((c) => (
                <CompanionRow key={c.key} c={c} suffix="galibiyet" />
              ))}
            </Card>
          )}

          {career.lostTo.length > 0 && (
            <Card>
              <Label>Karşında zorlandıkların</Label>
              <Text
                style={[type.bodyS, { color: colors.textSecondary, marginBottom: space[2] }]}
              >
                Karşı takımdayken en çok kaybettiğin kişiler.
              </Text>
              {career.lostTo.map((c) => (
                <CompanionRow key={c.key} c={c} suffix="mağlubiyet" />
              ))}
            </Card>
          )}

          {career.timeline.length > 0 && (
            <Card>
              <Label>Puan zaman şeridi</Label>
              <Text
                style={[type.bodyS, { color: colors.textSecondary, marginBottom: space[2] }]}
              >
                Her maç sonu puanlamasının yetenek puanlarına toplam etkisi.
              </Text>
              {career.timeline.map((t) => (
                <View key={`${t.groupId}-${t.matchId}`} style={s.timelineRow}>
                  <View
                    style={[
                      s.dot,
                      {
                        backgroundColor:
                          t.netDelta > 0
                            ? colors.pitch
                            : t.netDelta < 0
                            ? colors.brick
                            : colors.ink300,
                      },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[type.bodyMMedium, { color: colors.ink }]}>
                      {shortDate(t.at)}
                    </Text>
                    <Text style={[type.bodyS, { color: colors.textTertiary }]}>
                      {isAll ? `${t.groupName} · ` : ""}
                      {t.matchAverage != null ? `maç puanın ${t.matchAverage}` : "puan yok"}
                      {t.penaltyDelta < 0 ? " · puanlama cezası" : ""}
                    </Text>
                  </View>
                  <Text
                    style={[
                      type.scoreS,
                      {
                        color:
                          t.netDelta > 0
                            ? colors.pitch
                            : t.netDelta < 0
                            ? colors.brick
                            : colors.textSecondary,
                      },
                    ]}
                  >
                    {signed(t.netDelta)}
                  </Text>
                </View>
              ))}
            </Card>
          )}
        </>
      )}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={[type.scoreM, { color: colors.pitch900 }]}>{value}</Text>
      <Text style={[type.labelS, { color: colors.textTertiary, textTransform: "uppercase" }]}>
        {label}
      </Text>
    </View>
  );
}

function CompanionRow({ c, suffix }: { c: Companion; suffix: string }) {
  return (
    <View style={s.timelineRow}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textPrimary, fontWeight: "500" }}>
          {c.name}
          {c.isGuest ? " (misafir)" : ""}
        </Text>
      </View>
      <Text style={[type.bodyS, { color: colors.textSecondary }]}>
        {c.count} {suffix}
      </Text>
    </View>
  );
}

// Kucuk gelisim grafigi. react-native-svg native bir bagimlilik oldugu ve
// yeni build gerektirecegi icin cubuklar saf View ile ciziliyor: her cubuk
// bir mac sonrasi genel puani, yukseklik en dusuk-en yuksek araligina oranli.
function Sparkline({ points }: { points: RatingPoint[] }) {
  const values = points.map((p) => p.overall);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const rising = values[values.length - 1] >= values[0];
  const tint = rising ? colors.pitch : colors.brick;

  return (
    <View style={sp.wrap}>
      {points.map((p, i) => {
        // En dusuk nokta da gorunsun diye taban yukseklik birakiliyor.
        const ratio = (p.overall - min) / span;
        return (
          <View
            key={`${p.matchId ?? "start"}-${i}`}
            style={{
              flex: 1,
              height: 6 + ratio * 26,
              borderRadius: 2,
              backgroundColor: i === 0 ? colors.ink300 : tint,
              opacity: i === 0 ? 0.55 : 1,
            }}
          />
        );
      })}
    </View>
  );
}

const sp = {
  wrap: {
    flexDirection: "row" as const,
    alignItems: "flex-end" as const,
    gap: 3,
    height: 34,
    marginTop: space[3],
  },
};

const s = {
  statRow: {
    flexDirection: "row" as const,
    alignItems: "flex-end" as const,
    gap: space[3],
    marginTop: space[3],
  },
  head: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  timelineRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: space[3],
    paddingVertical: 8,
    borderTopWidth: border.width,
    borderTopColor: colors.borderDefault,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
};
