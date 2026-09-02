import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Button, Card, ErrorText, Field, Label, Screen } from "../../../../components/ui";
import { api, ApiError } from "../../../../lib/api";
import { positionLabel } from "../../../../lib/constants";
import { colors } from "../../../../lib/theme";

type Rating = { userId: string; name: string; overall: number };
type Guest = { id: string; name: string; overall: number };
type TeamPlayer = {
  userId: string;
  name: string;
  overall: number;
  primaryPosition: string | null;
  secondaryPosition: string | null;
  isGuest: boolean;
};
type Team = {
  index: number;
  players: TeamPlayer[];
  totalRating: number;
  averageRating: number;
};

export default function TeamsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestOverall, setGuestOverall] = useState("75");

  const [teamCount, setTeamCount] = useState(2);
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ ratings: Rating[] }>(`/api/groups/${id}/ratings`);
      setRatings(data.ratings);
      setSelected(new Set(data.ratings.map((r) => r.userId)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function addGuest() {
    const name = guestName.trim();
    const overall = Math.round(Number(guestOverall));
    if (!name || !Number.isFinite(overall) || overall < 60 || overall > 90) {
      setError("Misafir adı ve 60-90 arası güç puanı girmelisin.");
      return;
    }
    setGuests((prev) => [...prev, { id: `guest-${Date.now()}`, name, overall }]);
    setGuestName("");
    setGuestOverall("75");
    setError(null);
  }

  function removeGuest(guestId: string) {
    setGuests((prev) => prev.filter((g) => g.id !== guestId));
  }

  async function generate() {
    setError(null);
    setGenerating(true);
    try {
      const data = await api.post<{ teams: Team[] }>(`/api/groups/${id}/teams`, {
        teamCount,
        playerIds: Array.from(selected),
        guests: guests.map((g) => ({ name: g.name, overall: g.overall })),
      });
      setTeams(data.teams);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Takımlar oluşturulamadı.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <Screen>
        <ErrorText>{error}</ErrorText>

        <Card>
          <Label>Takım sayısı</Label>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable
              onPress={() => setTeamCount((n) => Math.max(2, n - 1))}
              style={{ padding: 10, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 8 }}
            >
              <Text style={{ fontSize: 16 }}>−</Text>
            </Pressable>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>{teamCount}</Text>
            <Pressable
              onPress={() => setTeamCount((n) => n + 1)}
              style={{ padding: 10, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 8 }}
            >
              <Text style={{ fontSize: 16 }}>+</Text>
            </Pressable>
          </View>
        </Card>

        <Card>
          <Label>Kadroya dahil edilecek oyuncular ({selected.size})</Label>
          {loading && (
            <View style={{ paddingVertical: 20 }}>
              <ActivityIndicator color={colors.pitch} />
            </View>
          )}
          {ratings.map((r) => {
            const checked = selected.has(r.userId);
            return (
              <Pressable key={r.userId} onPress={() => toggle(r.userId)}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.borderDefault,
                  }}
                >
                  <Text style={{ color: checked ? colors.textPrimary : colors.textSecondary }}>{r.name}</Text>
                  <Text style={{ color: checked ? colors.pitch : colors.textSecondary }}>
                    {checked ? "✓ Dahil" : "Hariç"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </Card>

        <Card>
          <Label>Misafir oyuncu ekle</Label>
          <Field value={guestName} onChangeText={setGuestName} placeholder="Misafir adı" />
          <Field
            value={guestOverall}
            onChangeText={setGuestOverall}
            placeholder="Güç (60-90)"
            keyboardType="number-pad"
          />
          <Button title="Misafir ekle" variant="secondary" onPress={addGuest} />
          {guests.map((g) => (
            <View
              key={g.id}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: 10,
              }}
            >
              <Text style={{ color: colors.textPrimary }}>
                {g.name} · {g.overall}
              </Text>
              <Pressable onPress={() => removeGuest(g.id)}>
                <Text style={{ color: colors.stateDanger }}>Kaldır</Text>
              </Pressable>
            </View>
          ))}
        </Card>

        <Button title="Takımları Oluştur" onPress={generate} loading={generating} />

        {teams && (
          <View style={{ marginTop: 16 }}>
            {teams.map((team) => (
              <Card key={team.index}>
                <Text style={{ fontWeight: "700", color: colors.textPrimary, marginBottom: 6 }}>
                  Takım {team.index + 1} · Ort. güç: {team.averageRating}
                </Text>
                {team.players.map((p) => (
                  <Text key={p.userId} style={{ color: colors.textSecondary, marginTop: 2 }}>
                    {p.name}
                    {p.isGuest ? " (misafir)" : ""} · {p.overall} ·{" "}
                    {positionLabel(p.primaryPosition)}
                  </Text>
                ))}
              </Card>
            ))}
          </View>
        )}
      </Screen>
    </ScrollView>
  );
}
