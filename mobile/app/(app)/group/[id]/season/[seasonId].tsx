import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Badge, Card, ErrorText, Label, ScoreBadge } from "../../../../../components/ui";
import { api, ApiError } from "../../../../../lib/api";
import { shortDate } from "../../../../../lib/format";
import { colors, space, type } from "../../../../../lib/theme";

type Summary = {
  standings: { userId: string; name: string; overall: number }[];
  records: {
    userId: string;
    name: string;
    played: number;
    wins: number;
    draws: number;
    losses: number;
  }[];
  mvp: { userId: string; name: string; wins: number } | null;
  matchCount: number;
};
type Season = {
  id: string;
  name: string;
  status: "active" | "closed";
  created_at: string;
  closed_at: string | null;
};

export default function SeasonSummaryScreen() {
  const { id, seasonId } = useLocalSearchParams<{ id: string; seasonId: string }>();
  const [season, setSeason] = useState<Season | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ season: Season; summary: Summary; live: boolean }>(
        `/api/groups/${id}/seasons/${seasonId}`
      );
      setSeason(data.season);
      setSummary(data.summary);
      setLive(data.live);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sezon yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [id, seasonId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surfacePage, padding: space[4] }}>
        <ActivityIndicator color={colors.pitch} />
      </View>
    );
  }

  if (!season || !summary) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surfacePage, padding: space[4] }}>
        <ErrorText>{error}</ErrorText>
      </View>
    );
  }

  const rankedRecords = [...summary.records]
    .filter((r) => r.played > 0)
    .sort((a, b) => b.wins - a.wins || b.played - a.played);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      contentContainerStyle={{ padding: space[4] }}
    >
      <View
        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
      >
        <Text style={[type.displayM, { color: colors.ink }]}>{season.name}</Text>
        <Badge tone={season.status === "active" ? "brand" : "neutral"}>
          {season.status === "active" ? "Aktif" : "Kapandı"}
        </Badge>
      </View>
      <Text style={[type.bodyS, { color: colors.textSecondary, marginTop: 4, marginBottom: space[3] }]}>
        {season.status === "closed" && season.closed_at
          ? `${shortDate(season.created_at)} – ${shortDate(season.closed_at)}`
          : `${shortDate(season.created_at)} – devam ediyor`}{" "}
        · {summary.matchCount} tamamlanan maç
      </Text>

      {live && (
        <Text style={[type.bodyS, { color: colors.textTertiary, marginBottom: space[3] }]}>
          Bu sezon devam ediyor; özet o ana kadarki duruma göre canlı hesaplanır.
        </Text>
      )}

      {summary.mvp && (
        <Card raised>
          <Label>Sezonun oyuncusu</Label>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: space[2],
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.textPrimary }}>
              {summary.mvp.name}
            </Text>
            <ScoreBadge value={summary.mvp.wins} label="GALİBİYET" />
          </View>
        </Card>
      )}

      <Card>
        <Label>Galibiyet kaydı</Label>
        {rankedRecords.length === 0 ? (
          <Text style={[type.bodyS, { color: colors.textSecondary }]}>
            Bu sezonda skorlanmış maç yok.
          </Text>
        ) : (
          <View style={{ marginTop: space[2] }}>
            <View style={{ flexDirection: "row", paddingBottom: 6 }}>
              <Text style={[type.labelS, { flex: 1, color: colors.textTertiary }]}>İSİM</Text>
              {["O", "G", "B", "M"].map((h) => (
                <Text
                  key={h}
                  style={[type.labelS, { width: 28, textAlign: "right", color: colors.textTertiary }]}
                >
                  {h}
                </Text>
              ))}
            </View>
            {rankedRecords.map((r) => (
              <View
                key={r.userId}
                style={{
                  flexDirection: "row",
                  paddingVertical: 6,
                  borderTopWidth: 1,
                  borderTopColor: colors.borderDefault,
                }}
              >
                <Text style={{ flex: 1, color: colors.textPrimary }}>{r.name}</Text>
                {[r.played, r.wins, r.draws, r.losses].map((v, i) => (
                  <Text key={i} style={{ width: 28, textAlign: "right", color: colors.textSecondary }}>
                    {v}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card>
        <Label>Güç sıralaması</Label>
        <View style={{ marginTop: space[2] }}>
          {summary.standings.map((s) => (
            <View
              key={s.userId}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingVertical: 6,
                borderTopWidth: 1,
                borderTopColor: colors.borderDefault,
              }}
            >
              <Text style={{ color: colors.textPrimary }}>{s.name}</Text>
              <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{s.overall}</Text>
            </View>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}
