import { Feather } from "@expo/vector-icons";
import { Tabs, router } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useActiveGroup } from "../../../lib/active-group";
import { border, colors, radius, space, type } from "../../../lib/theme";

// Tasarimdaki alt bar: 4 gercek sekme + rota olmayan "Daha Fazla" menusu.
const MORE_ITEMS = [
  { label: "Oylama", path: "vote" },
  { label: "Takım Oluştur", path: "teams" },
  { label: "Puan Detayları", path: "breakdown" },
] as const;

export default function TabsLayout() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { activeGroup } = useActiveGroup();
  const insets = useSafeAreaInsets();

  function goGroupRoute(path: string) {
    setMoreOpen(false);
    if (!activeGroup) return;
    router.push(`/group/${activeGroup.id}/${path}`);
  }

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.pitch,
          tabBarInactiveTintColor: colors.ink300,
          tabBarStyle: {
            backgroundColor: colors.chalk100,
            borderTopWidth: border.width,
            borderTopColor: colors.borderDefault,
            height: 58 + insets.bottom,
            paddingTop: space[2] - 2,
            paddingBottom: insets.bottom + space[2],
          },
          tabBarLabelStyle: {
            ...type.labelS,
            textTransform: "uppercase",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Ana Sayfa",
            tabBarIcon: ({ color }) => <Feather name="home" size={21} color={color} />,
          }}
        />
        <Tabs.Screen
          name="groups"
          options={{
            title: "Takımlarım",
            tabBarIcon: ({ color }) => <Feather name="users" size={21} color={color} />,
          }}
        />
        <Tabs.Screen
          name="matches"
          options={{
            title: "Maçlar",
            tabBarIcon: ({ color }) => (
              <Feather name="calendar" size={21} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profil",
            tabBarIcon: ({ color }) => <Feather name="user" size={21} color={color} />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: "Daha Fazla",
            tabBarIcon: ({ color }) => (
              <Feather name="more-horizontal" size={21} color={color} />
            ),
          }}
          listeners={{
            // Bu bir rota degil; dokununca menu acilir.
            tabPress: (e) => {
              e.preventDefault();
              setMoreOpen(true);
            },
          }}
        />
      </Tabs>

      <Modal
        visible={moreOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setMoreOpen(false)}>
          <View style={[styles.sheet, { marginBottom: insets.bottom + 70 }]}>
            <Text style={styles.sheetHeader}>DAHA FAZLA</Text>
            {MORE_ITEMS.map((item, index) => (
              <Pressable
                key={item.path}
                onPress={() => goGroupRoute(item.path)}
                style={[styles.item, index < MORE_ITEMS.length && styles.itemBorder]}
              >
                <Text style={styles.itemText}>{item.label}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => {
                setMoreOpen(false);
                if (activeGroup) router.push(`/group/${activeGroup.id}`);
              }}
              style={styles.item}
            >
              <Text style={styles.itemText}>
                {activeGroup
                  ? `Davet Kodu · ${activeGroup.invite_code}`
                  : "Takım seçilmedi"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = {
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(22,35,28,0.28)",
    justifyContent: "flex-end" as const,
    alignItems: "flex-end" as const,
    paddingHorizontal: space[3] - 2,
  },
  sheet: {
    width: 212,
    backgroundColor: colors.surfaceCardRaised,
    borderWidth: border.width,
    borderColor: colors.borderDefault,
    borderRadius: radius.card,
    overflow: "hidden" as const,
  },
  sheetHeader: {
    ...type.labelS,
    textTransform: "uppercase" as const,
    color: colors.textTertiary,
    paddingHorizontal: space[3] + 2,
    paddingTop: space[3] - 2,
    paddingBottom: space[2],
    borderBottomWidth: border.width,
    borderBottomColor: colors.borderDefault,
  },
  item: {
    paddingHorizontal: space[3] + 2,
    paddingVertical: space[3] + 1,
  },
  itemBorder: {
    borderBottomWidth: border.width,
    borderBottomColor: colors.borderDefault,
  },
  itemText: {
    ...type.bodyM,
    color: colors.ink,
  },
};
