import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Badge, Button, Card, ErrorText, Field, Label } from "../../../components/ui";
import { api, ApiError } from "../../../lib/api";
import { useActiveGroup } from "../../../lib/active-group";
import { useAuth } from "../../../lib/auth-context";
import { border, colors, radius, space, type } from "../../../lib/theme";

export default function GroupsScreen() {
  const { groups, activeGroup, isAll, setScope, refresh, loading } = useActiveGroup();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [newGroupName, setNewGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  async function createGroup() {
    if (newGroupName.trim().length < 2) {
      setError("Takım adı en az 2 karakter olmalı.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/groups", { name: newGroupName.trim() });
      setNewGroupName("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Takım oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function joinGroup() {
    if (!inviteCode.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/groups/join", { inviteCode: inviteCode.trim() });
      setInviteCode("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Takıma katılınamadı.");
    } finally {
      setBusy(false);
    }
  }

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
      <View style={{ marginBottom: space[1] }}>
        <Text style={s.eyebrow}>MATCHRATING</Text>
        <Text style={[type.displayM, { color: colors.ink, marginTop: 2 }]}>
          Takımlarım
        </Text>
      </View>

      <ErrorText>{error}</ErrorText>

      {!isAll && (
        <View style={{ marginBottom: space[3] }}>
          <Button
            title="Tüm takımları göster"
            variant="secondary"
            onPress={() => setScope(null)}
          />
        </View>
      )}

      {!loading && groups.length === 0 && (
        <Card>
          <Text style={[type.bodyM, { color: colors.textSecondary }]}>
            Henüz bir takımın yok. Aşağıdan yeni bir takım kur ya da davet koduyla
            katıl.
          </Text>
        </Card>
      )}

      {groups.map((g) => {
        const isActive = g.id === activeGroup?.id;
        return (
          <Pressable key={g.id} onPress={() => setScope(g.id)}>
            <View style={[s.groupCard, isActive && s.groupCardActive]}>
              <View style={s.groupHead}>
                <Text style={[type.displayS, { color: colors.ink, flex: 1 }]}>
                  {g.name}
                </Text>
                {isActive ? (
                  <Badge tone="brand">Seçili</Badge>
                ) : (
                  <Text style={[type.bodyS, { color: colors.textTertiary }]}>
                    Odaklanmak için dokun
                  </Text>
                )}
              </View>

              <View style={s.groupMeta}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Feather name="users" size={14} color={colors.ink300} />
                  <Text style={[type.bodyS, { color: colors.textSecondary }]}>
                    {g.member_count} üye
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Feather name="hash" size={14} color={colors.ink300} />
                  <Text style={[type.bodyS, { color: colors.textSecondary }]}>
                    {g.invite_code}
                  </Text>
                </View>
              </View>

              <View style={s.groupActions}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Takıma git"
                    variant="secondary"
                    size="small"
                    onPress={() => router.push(`/group/${g.id}`)}
                  />
                </View>
                {g.owner_id === user?.id && (
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Maç oluştur"
                      size="small"
                      onPress={() => router.push(`/group/${g.id}/match/new`)}
                    />
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        );
      })}

      <Card>
        <Label>Yeni takım oluştur</Label>
        <Field
          value={newGroupName}
          onChangeText={setNewGroupName}
          placeholder="Takım adı"
        />
        <Button title="Oluştur" onPress={createGroup} loading={busy} />
      </Card>

      <Card>
        <Label>Davet koduyla katıl</Label>
        <Field
          value={inviteCode}
          onChangeText={setInviteCode}
          placeholder="Örn: AB12CD"
          autoCapitalize="characters"
        />
        <Button title="Katıl" variant="secondary" onPress={joinGroup} loading={busy} />
      </Card>
    </ScrollView>
  );
}

const s = {
  eyebrow: {
    ...type.labelS,
    textTransform: "uppercase" as const,
    color: colors.ink300,
  },
  groupCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: border.width,
    borderColor: colors.borderDefault,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[3],
  },
  groupCardActive: {
    backgroundColor: colors.surfaceCardRaised,
    borderWidth: border.widthThick,
    borderColor: colors.pitch,
  },
  groupHead: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: space[2],
  },
  groupMeta: {
    flexDirection: "row" as const,
    gap: space[4],
  },
  groupActions: {
    flexDirection: "row" as const,
    gap: space[2],
  },
};
