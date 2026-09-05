import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Badge, Button, Card, ErrorText } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { shortDate } from "../../lib/format";
import { border, colors, space, type } from "../../lib/theme";

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  group_id: string | null;
  match_id: string | null;
  group_name: string | null;
  read_at: string | null;
  created_at: string;
};

export default function NotificationsScreen() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.get<{ notifications: Notification[] }>("/api/notifications");
      setItems(d.notifications);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function markAll() {
    await api.patch("/api/notifications", {});
    setItems((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
    );
  }

  function open(n: Notification) {
    if (!n.read_at) api.patch("/api/notifications", { id: n.id }).catch(() => {});
    if (n.group_id && n.match_id) router.push(`/group/${n.group_id}/match/${n.match_id}`);
    else if (n.group_id) router.push(`/group/${n.group_id}`);
  }

  const unread = items.filter((n) => !n.read_at).length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      contentContainerStyle={{ padding: space[4], gap: space[3] }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <ErrorText>{error}</ErrorText>

      {unread > 0 && (
        <Button title="Tümünü okundu yap" variant="secondary" onPress={markAll} />
      )}

      {loading && (
        <View style={{ paddingVertical: 24 }}>
          <ActivityIndicator color={colors.pitch} />
        </View>
      )}

      {!loading && items.length === 0 && (
        <Card>
          <Text style={[type.bodyM, { color: colors.textSecondary }]}>
            Henüz bildirimin yok. Takımında bir maç açıldığında ya da tarih
            kesinleştiğinde burada göreceksin.
          </Text>
        </Card>
      )}

      {items.map((n) => (
        <Pressable key={n.id} onPress={() => open(n)}>
          <Card style={!n.read_at ? { borderLeftWidth: 3, borderLeftColor: colors.amber } : undefined}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[type.bodyMMedium, { color: colors.ink, flex: 1 }]}>{n.title}</Text>
              {!n.read_at && <Badge tone="accent">Yeni</Badge>}
            </View>
            {n.body ? (
              <Text style={[type.bodyS, { color: colors.textSecondary, marginTop: 4 }]}>
                {n.body}
              </Text>
            ) : null}
            <Text style={[type.bodyS, { color: colors.textTertiary, marginTop: 4 }]}>
              {n.group_name ? `${n.group_name} · ` : ""}
              {shortDate(n.created_at)}
            </Text>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}
