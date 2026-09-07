import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { Card, ErrorText } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { border, colors, space, type } from "../../lib/theme";

// Bildirim ayarlari.
//
// Turleri SUNUCUDAN aliyoruz: yeni bir bildirim turu eklendiginde
// mobil surumu guncellemek gerekmesin, ekran gelen listeyi cizsin.
//
// Varsayilan hepsi acik. Kapatilan tur ne telefona duser ne de
// Bildirimler ekraninda gorunur -- kutuyu kaldiran biri zilde de gormek
// istemiyordur.

type Pref = {
  kind: string;
  label: string;
  description: string;
  enabled: boolean;
};

export default function NotificationSettingsScreen() {
  const [prefs, setPrefs] = useState<Pref[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.get<{ prefs: Pref[] }>("/api/notifications/prefs");
      setPrefs(d.prefs);
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

  async function toggle(kind: string, enabled: boolean) {
    // Anahtar hemen hareket etsin: istegi beklemek "calismadi" hissi
    // veriyor. Basarisiz olursa geri aliyoruz.
    setPrefs((prev) => prev.map((p) => (p.kind === kind ? { ...p, enabled } : p)));
    setSaving(kind);
    setError(null);
    try {
      await api.patch("/api/notifications/prefs", { kind, enabled });
    } catch (err) {
      setPrefs((prev) =>
        prev.map((p) => (p.kind === kind ? { ...p, enabled: !enabled } : p))
      );
      setError(err instanceof ApiError ? err.message : "Kaydedilemedi.");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.pitch} />
      </View>
    );
  }

  const off = prefs.filter((p) => !p.enabled).length;

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.intro}>
        Kapattığın bildirimler ne telefonuna düşer ne de Bildirimler ekranında
        görünür.{off > 0 ? ` Şu an ${off} tanesi kapalı.` : " Hepsi açık."}
      </Text>

      <ErrorText>{error}</ErrorText>

      <Card>
        {prefs.map((p, i) => (
          <View
            key={p.kind}
            style={[styles.row, i < prefs.length - 1 && styles.rowBorder]}
          >
            <View style={styles.rowText}>
              <Text style={styles.label}>{p.label}</Text>
              <Text style={styles.description}>{p.description}</Text>
            </View>
            <Switch
              value={p.enabled}
              disabled={saving === p.kind}
              onValueChange={(v) => toggle(p.kind, v)}
              trackColor={{ false: colors.chalk300, true: colors.pitch300 }}
              thumbColor={p.enabled ? colors.pitch : colors.chalk100}
            />
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = {
  center: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: colors.surfacePage,
  },
  page: {
    padding: space[3],
    gap: space[3],
    paddingBottom: space[5],
  },
  intro: {
    ...type.bodyM,
    color: colors.textSecondary,
    paddingHorizontal: space[1],
  },
  row: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: space[3],
    paddingVertical: space[3] - 2,
  },
  rowBorder: {
    borderBottomWidth: border.width,
    borderBottomColor: colors.borderDefault,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...type.bodyMMedium,
    color: colors.textPrimary,
  },
  description: {
    ...type.bodyS,
    color: colors.textSecondary,
  },
};
