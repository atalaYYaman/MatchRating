import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Badge, Button, Card, ErrorText, Label } from "../../../../components/ui";
import { api, ApiError } from "../../../../lib/api";
import { shortDate } from "../../../../lib/format";
import { colors, space, type } from "../../../../lib/theme";

type Season = {
  id: string;
  name: string;
  status: "active" | "closed";
  created_at: string;
  closed_at: string | null;
  matchCount: number;
};

export default function SeasonsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ seasons: Season[]; isOwner: boolean }>(
        `/api/groups/${id}/seasons`
      );
      setSeasons(data.seasons);
      setIsOwner(data.isOwner);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sezonlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function confirmClose() {
    const active = seasons.find((s) => s.status === "active");
    Alert.alert(
      "Aktif sezonu kapat",
      `"${active?.name}" kapatılacak; o anki sıralama ve galibiyet kaydı özet olarak dondurulacak ve yeni bir sezon başlayacak.`,
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Kapat", style: "destructive", onPress: closeSeason },
      ]
    );
  }

  async function closeSeason() {
    setClosing(true);
    setError(null);
    try {
      await api.post(`/api/groups/${id}/seasons`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sezon kapatılamadı.");
    } finally {
      setClosing(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      contentContainerStyle={{ padding: space[4] }}
    >
      <Text style={[type.bodyS, { color: colors.textSecondary, marginBottom: space[3] }]}>
        Sezon, maçları ve galibiyet kaydını kapsayan bir dönemdir. Yönetici sezonu
        kapattığında o anki durum özet olarak saklanır; yetenek puanları sezonlar arası
        korunur.
      </Text>

      <ErrorText>{error}</ErrorText>

      {loading && (
        <View style={{ paddingVertical: 20 }}>
          <ActivityIndicator color={colors.pitch} />
        </View>
      )}

      {seasons.map((s) => (
        <Pressable key={s.id} onPress={() => router.push(`/group/${id}/season/${s.id}`)}>
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", color: colors.textPrimary }}>{s.name}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                  {s.matchCount} maç ·{" "}
                  {s.status === "closed" && s.closed_at
                    ? `${shortDate(s.created_at)} – ${shortDate(s.closed_at)}`
                    : `${shortDate(s.created_at)} – devam ediyor`}
                </Text>
              </View>
              <Badge tone={s.status === "active" ? "brand" : "neutral"}>
                {s.status === "active" ? "Aktif" : "Kapandı"}
              </Badge>
            </View>
          </Card>
        </Pressable>
      ))}

      {isOwner && seasons.some((s) => s.status === "active") && (
        <Card style={{ marginTop: space[5] }}>
          <Label>Sezon yönetimi</Label>
          <Text style={[type.bodyS, { color: colors.textSecondary, marginBottom: space[3] }]}>
            Aktif sezonu kapatınca özeti dondurulur ve otomatik adlı yeni bir sezon
            başlar. Bu işlem geri alınamaz.
          </Text>
          <Button
            title="Aktif sezonu kapat"
            variant="danger"
            loading={closing}
            onPress={confirmClose}
          />
        </Card>
      )}
    </ScrollView>
  );
}
