import { Redirect, Stack } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { ActiveGroupProvider } from "../../lib/active-group";
import { useAuth } from "../../lib/auth-context";
import {
  addNotificationTapListener,
  consumeInitialNotification,
  registerForPush,
} from "../../lib/push";
import { colors, type } from "../../lib/theme";

export default function AppLayout() {
  const { user, loading } = useAuth();

  // Push kaydi GIRIS SONRASI yapilir: token kullaniciya baglaniyor, once
  // kaydedersek bildirim yanlis hesaba gider. Bildirime dokunma dinleyicisi
  // de burada, cunku yonlendirme oturum acikken anlamli.
  useEffect(() => {
    if (!user) return;
    void registerForPush();
    void consumeInitialNotification();
    const sub = addNotificationTapListener();
    return () => sub.remove();
  }, [user]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surfacePage,
        }}
      >
        <ActivityIndicator color={colors.pitch} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <ActiveGroupProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.chalk100 },
          headerTintColor: colors.ink,
          headerTitleStyle: { ...type.displayS },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.surfacePage },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="kariyer" options={{ title: "Kariyerim" }} />
        <Stack.Screen name="geri-bildirim" options={{ title: "Geri Bildirim" }} />
        <Stack.Screen name="bildirimler" options={{ title: "Bildirimler" }} />
        <Stack.Screen name="bildirim-durumu" options={{ title: "Bildirim Durumu" }} />
        <Stack.Screen
          name="bildirim-ayarlari"
          options={{ title: "Bildirim Ayarları" }}
        />
        <Stack.Screen name="group/[id]/index" options={{ title: "Takım" }} />
        <Stack.Screen name="group/[id]/vote" options={{ title: "Oylama Yap" }} />
        <Stack.Screen name="group/[id]/teams" options={{ title: "Takımları Oluştur" }} />
        <Stack.Screen name="group/[id]/breakdown" options={{ title: "Puan Detayı" }} />
        <Stack.Screen name="group/[id]/seasons" options={{ title: "Sezonlar" }} />
        <Stack.Screen name="group/[id]/season/[seasonId]" options={{ title: "Sezon" }} />
        <Stack.Screen name="group/[id]/match/new" options={{ title: "Yeni Maç" }} />
        <Stack.Screen name="group/[id]/match/[matchId]/index" options={{ title: "Maç" }} />
        <Stack.Screen
          name="group/[id]/match/[matchId]/rate"
          options={{ title: "Maçı Oyla" }}
        />
        <Stack.Screen
          name="group/[id]/match/[matchId]/squads"
          options={{ title: "Kadrolar" }}
        />
      </Stack>
    </ActiveGroupProvider>
  );
}
