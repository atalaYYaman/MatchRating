import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../../lib/auth-context";
import { colors } from "../../lib/theme";

export default function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surfaceCard },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="dashboard" options={{ title: "Takımlarım" }} />
      <Stack.Screen name="group/[id]/index" options={{ title: "Takım" }} />
      <Stack.Screen name="group/[id]/vote" options={{ title: "Oylama Yap" }} />
      <Stack.Screen name="group/[id]/teams" options={{ title: "Takımları Oluştur" }} />
      <Stack.Screen name="group/[id]/breakdown" options={{ title: "Puan Detayı" }} />
    </Stack>
  );
}
