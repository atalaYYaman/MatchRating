import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import {
  Button,
  Card,
  ErrorText,
  Field,
  InlineMessage,
  Label,
  ScoreBadge,
} from "../../../../../../components/ui";
import { api, ApiError } from "../../../../../../lib/api";
import { PositionKey, positionLabel } from "../../../../../../lib/constants";
import { PositionPicker } from "../../../../../../components/PositionPicker";
import { colors, space } from "../../../../../../lib/theme";

type SquadPlayer = {
  id: string;
  userId: string | null;
  name: string;
  isGuest: boolean;
  overall: number;
  primaryPosition: string | null;
  secondaryPosition: string | null;
};
type Squads = { locked: boolean; home: SquadPlayer[]; away: SquadPlayer[] };

type Detail = {
  match: { match_kind: "ic" | "dis"; status: string };
  isOwner: boolean;
  attendance: { user_id: string; status: "yes" | "no"; name: string }[];
  squads: Squads | null;
};

type Guest = {
  id: string;
  name: string;
  overall: number;
  primaryPosition: PositionKey | "";
  secondaryPosition: PositionKey | "";
};

export default function MatchSquadsScreen() {
  const { id, matchId } = useLocalSearchParams<{ id: string; matchId: string }>();

  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestOverall, setGuestOverall] = useState("75");
  const [guestPrimary, setGuestPrimary] = useState<PositionKey | "">("");
  const [guestSecondary, setGuestSecondary] = useState<PositionKey | "">("");

  const load = useCallback(async () => {
    try {
      const res = await api.get<Detail>(`/api/groups/${id}/matches/${matchId}`);
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Maç yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [id, matchId]);

  useEffect(() => {
    load();
  }, [load]);

  function addGuest() {
    const name = guestName.trim();
    const overall = Math.round(Number(guestOverall));
    if (!name || !Number.isFinite(overall) || overall < 60 || overall > 90) {
      setError("Misafir adı ve 60-90 arası güç puanı girmelisin.");
      return;
    }
    setGuests((prev) => [
      ...prev,
      {
        id: `guest-${Date.now()}`,
        name,
        overall,
        primaryPosition: guestPrimary,
        secondaryPosition: guestSecondary,
      },
    ]);
    setGuestName("");
    setGuestOverall("75");
    setGuestPrimary("");
    setGuestSecondary("");
    setError(null);
  }

  function removeGuest(guestId: string) {
    setGuests((prev) => prev.filter((g) => g.id !== guestId));
  }

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/groups/${id}/matches/${matchId}/squads`, {
        guests: guests.map((g) => ({
          name: g.name,
          overall: g.overall,
          primaryPosition: g.primaryPosition || null,
          secondaryPosition: g.secondaryPosition || null,
        })),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kadrolar oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function move(playerId: string, toSide: "home" | "away") {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/groups/${id}/matches/${matchId}/squads`, {
        action: "move",
        playerId,
        toSide,
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Oyuncu taşınamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleLock(locked: boolean) {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/groups/${id}/matches/${matchId}/squads`, {
        action: locked ? "unlock" : "lock",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İşlem başarısız.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surfacePage, padding: space[4] }}>
        <ActivityIndicator color={colors.pitch} />
      </View>
    );
  }

  if (!data || data.match.match_kind !== "ic") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surfacePage, padding: space[4] }}>
        <ErrorText>{error}</ErrorText>
        <Card>
          <Text style={{ color: colors.textSecondary }}>
            Kadrolar yalnızca takım içi maçlarda kullanılır.
          </Text>
        </Card>
      </View>
    );
  }

  const attendees = data.attendance.filter((a) => a.status === "yes");
  const squads = data.squads;
  const locked = squads?.locked ?? false;
  const canManage = data.isOwner && data.match.status !== "cancelled";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      contentContainerStyle={{ padding: space[4], gap: space[3] }}
    >
      <Card>
        <Text style={{ color: colors.textSecondary }}>
          Yoklamaya katılıyorum diyen {attendees.length} oyuncu, güç ve mevki
          dağılımına göre iki takıma bölünür.
        </Text>
      </Card>

      <ErrorText>{error}</ErrorText>

      {canManage && !locked && (
        <Card>
          <Label>Misafir oyuncu ekle</Label>
          <Field value={guestName} onChangeText={setGuestName} placeholder="Misafir adı" />
          <Field
            value={guestOverall}
            onChangeText={setGuestOverall}
            placeholder="Güç (60-90)"
            keyboardType="number-pad"
          />
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: space[2] }}>
            MEVKİ — ÖNCE BİRİNCİL, SONRA İKİNCİL
          </Text>
          <PositionPicker
            primary={guestPrimary}
            secondary={guestSecondary}
            onChange={(next) => {
              setGuestPrimary(next.primary);
              setGuestSecondary(next.secondary);
            }}
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
                {g.primaryPosition ? ` · ${positionLabel(g.primaryPosition)}` : ""}
              </Text>
              <Text style={{ color: colors.stateDanger }} onPress={() => removeGuest(g.id)}>
                Kaldır
              </Text>
            </View>
          ))}

          <View style={{ marginTop: space[3] }}>
            <Button
              title={squads ? "Kadroları karıştır" : "Kadroları oluştur"}
              onPress={generate}
              loading={busy}
              disabled={attendees.length + guests.length < 2}
            />
          </View>
        </Card>
      )}

      {locked && canManage && (
        <InlineMessage tone="neutral">
          Kadro kilitli. Değiştirmek için önce kilidi açmalısın.
        </InlineMessage>
      )}

      {squads && (
        <>
          <SquadCard
            title="Takım 1"
            players={squads.home}
            locked={locked}
            canManage={canManage}
            busy={busy}
            onMove={(playerId) => move(playerId, "away")}
            moveLabel="Takım 2'ye taşı"
          />
          <SquadCard
            title="Takım 2"
            players={squads.away}
            locked={locked}
            canManage={canManage}
            busy={busy}
            onMove={(playerId) => move(playerId, "home")}
            moveLabel="Takım 1'e taşı"
          />

          {canManage && (
            <Button
              title={locked ? "Kilidi aç" : "Kadroyu kilitle"}
              variant="secondary"
              onPress={() => toggleLock(locked)}
              loading={busy}
            />
          )}
        </>
      )}
    </ScrollView>
  );
}

function SquadCard({
  title,
  players,
  locked,
  canManage,
  busy,
  onMove,
  moveLabel,
}: {
  title: string;
  players: SquadPlayer[];
  locked: boolean;
  canManage: boolean;
  busy: boolean;
  onMove: (playerId: string) => void;
  moveLabel: string;
}) {
  const total = players.reduce((sum, p) => sum + p.overall, 0);
  const avg = players.length > 0 ? Math.round((total / players.length) * 10) / 10 : 0;

  return (
    <Card raised>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text style={{ fontWeight: "700", color: colors.textPrimary, fontSize: 16 }}>
            {title}
          </Text>
          <Text style={{ color: colors.textSecondary }}>{players.length} oyuncu</Text>
        </View>
        <ScoreBadge value={avg} label="ORT. GÜÇ" />
      </View>

      <View style={{ marginTop: space[3] }}>
        {players.map((p) => (
          <View
            key={p.id}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: colors.borderDefault,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: "500" }}>
                {p.name}
                {p.isGuest ? " (misafir)" : ""}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                {positionLabel(p.primaryPosition)} / {positionLabel(p.secondaryPosition)}
              </Text>
            </View>
            <Text style={{ color: colors.textSecondary }}>{p.overall}</Text>
          </View>
        ))}
        {players.length === 0 && (
          <Text style={{ color: colors.textSecondary }}>Bu takımda henüz oyuncu yok.</Text>
        )}
      </View>

      {canManage && !locked && players.length > 0 && (
        <View style={{ marginTop: space[3], gap: 6 }}>
          {players.map((p) => (
            <Button
              key={p.id}
              title={`${p.name}: ${moveLabel}`}
              variant="secondary"
              size="small"
              onPress={() => onMove(p.id)}
              disabled={busy}
            />
          ))}
        </View>
      )}
    </Card>
  );
}
