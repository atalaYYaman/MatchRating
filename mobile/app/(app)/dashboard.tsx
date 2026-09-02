import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Button, Card, ErrorText, Field, Label, Screen } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { colors } from "../../lib/theme";

type Group = {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  member_count: number;
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newGroupName, setNewGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ groups: Group[] }>("/api/groups");
      setGroups(data.groups);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Takımlar yüklenemedi.");
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function createGroup() {
    if (newGroupName.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/groups", { name: newGroupName.trim() });
      setNewGroupName("");
      await load();
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
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Takıma katılınamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <FlatList
        data={groups}
        keyExtractor={(g) => g.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
            <ErrorText>{error}</ErrorText>

            <Card>
              <Text style={{ fontWeight: "600", marginBottom: 8 }}>
                {user?.name} olarak giriş yaptın
              </Text>
              <Button title="Çıkış yap" variant="secondary" onPress={logout} />
            </Card>

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
              <Button title="Katıl" onPress={joinGroup} loading={busy} />
            </Card>

            {!loading && groups.length === 0 && (
              <Text style={{ color: colors.textSecondary, textAlign: "center", marginTop: 8 }}>
                Henüz bir takımın yok.
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/group/${item.id}`)}>
            <Card>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
                {item.name}
              </Text>
              <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                {item.member_count} üye · Davet kodu: {item.invite_code}
              </Text>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}
