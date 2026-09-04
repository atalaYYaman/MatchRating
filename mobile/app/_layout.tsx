import {
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
} from "@expo-google-fonts/archivo";
import {
  PublicSans_400Regular,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
  useFonts,
} from "@expo-google-fonts/public-sans";
import { Stack } from "expo-router";
import * as Updates from "expo-updates";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../lib/auth-context";
import { colors } from "../lib/theme";

export default function RootLayout() {
  // OTA guncellemesini acilista indirip HEMEN uygula.
  //
  // expo-updates varsayilani: acilista kontrol et, arka planda indir, bir
  // SONRAKI acilista uygula. Yani kullanicinin uygulamayi iki kez tamamen
  // kapatip acmasi gerekiyordu; cogu kisi bunu yapmadigi icin guncelleme
  // "gelmemis" gibi gorunuyordu. Neredeyse her seyi OTA ile dagittigimiz
  // icin bu davranis bize pahaliya mal oluyor.
  useEffect(() => {
    // Expo Go / gelistirme ortaminda updates devre disi; orada dokunma.
    if (!Updates.isEnabled) return;
    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable) return;
        await Updates.fetchUpdateAsync();
        // Uygulanan guncelleme sonrasi checkForUpdateAsync artik false
        // dondugu icin dongu olusmaz.
        await Updates.reloadAsync();
      } catch {
        // Ag yoksa ya da kontrol basarisizsa uygulama mevcut haliyle acilir;
        // guncelleme bir sonraki acilista denenir.
      }
    })();
  }, []);

  // Archivo (skorbord/baslik) + Public Sans (govde) tasarim sisteminin
  // temel kimlik sinyali; yuklenmeden ekran cizilmez.
  const [fontsLoaded] = useFonts({
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
    PublicSans_400Regular,
    PublicSans_500Medium,
    PublicSans_600SemiBold,
  });

  if (!fontsLoaded) {
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

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
