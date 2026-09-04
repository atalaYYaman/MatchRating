import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, Divider } from "../../../components/ui";
import { useActiveGroup } from "../../../lib/active-group";
import { useAuth } from "../../../lib/auth-context";
import { colors, radius, space, type } from "../../../lib/theme";

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { groups, activeGroup } = useActiveGroup();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      contentContainerStyle={{
        paddingTop: insets.top + space[2],
        paddingHorizontal: space[4],
        paddingBottom: space[5],
        gap: space[3],
      }}
    >
      <View>
        <Text style={s.eyebrow}>MATCHRATING</Text>
        <Text style={[type.displayM, { color: colors.ink, marginTop: 2 }]}>Profil</Text>
      </View>

      <Card raised>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
          <View style={s.avatar}>
            <Feather name="user" size={22} color={colors.ink100} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[type.displayS, { color: colors.ink }]}>{user?.name}</Text>
            <Text style={[type.bodyS, { color: colors.textSecondary }]}>
              {user?.email}
            </Text>
          </View>
        </View>
      </Card>

      <Card>
        <Text style={s.eyebrow}>ÖZET</Text>
        <View style={{ flexDirection: "row", marginTop: space[3] }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[type.scoreL, { color: colors.pitch900 }]}>
              {groups.length}
            </Text>
            <Text style={s.eyebrow}>TAKIM</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[type.bodyMMedium, { color: colors.ink }]}>
              {activeGroup?.name ?? "—"}
            </Text>
            <Text style={s.eyebrow}>AKTİF TAKIM</Text>
          </View>
        </View>
      </Card>

      <Card style={{ padding: 0 }}>
        <Pressable style={s.row} onPress={() => router.push("/geri-bildirim")}>
          <Text style={[type.bodyM, { color: colors.ink }]}>Geri bildirim gönder</Text>
          <Feather name="chevron-right" size={18} color={colors.ink300} />
        </Pressable>
        <Divider />
        <View style={s.row}>
          <Text style={[type.bodyM, { color: colors.ink }]}>Gizlilik politikası</Text>
        </View>
        <Divider />
        <View style={s.row}>
          <Text style={[type.bodyM, { color: colors.ink }]}>Hesap silme talebi</Text>
        </View>
      </Card>

      <Button title="Çıkış yap" variant="secondary" onPress={logout} />
    </ScrollView>
  );
}

const s = {
  eyebrow: {
    ...type.labelS,
    textTransform: "uppercase" as const,
    color: colors.ink300,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.chalk200,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  row: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    minHeight: 44,
    paddingHorizontal: space[4],
    paddingVertical: space[3] + 2,
  },
};
