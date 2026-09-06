import { router } from "expo-router";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { api } from "./api";

// Push bildirimleri.
//
// Uygulama ici bildirim sistemi (Bildirimler ekrani) bundan bagimsiz
// calisir; push yalnizca "haberin olsun" katmani. Bu yuzden buradaki
// hicbir hata uygulamayi durdurmaz, sessizce gecilir.

// Uygulama acikken de bildirim gorunsun: varsayilanda on plandayken
// hicbir sey gostermiyor, kullanici bir sey olmadi saniyor.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function projectId(): string | undefined {
  // EAS derlemesinde buradan gelir; Expo Go'da tanimsiz olabilir.
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

/**
 * Izin ister, token alir ve sunucuya kaydeder.
 * Giris yapildiktan SONRA cagrilmali: token kullaniciya baglaniyor.
 */
export async function registerForPush(): Promise<string | null> {
  try {
    // Emulatorde push token uretilemiyor; denemek hata firlatiyor.
    if (!Device.isDevice) return null;

    if (Platform.OS === "android") {
      // Android 8+ kanal olmadan bildirim gostermiyor.
      await Notifications.setNotificationChannelAsync("default", {
        name: "Genel",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#1F5C3F",
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      // Reddedildiyse tekrar tekrar sormuyoruz; sistem zaten sormaz ama
      // kullaniciyi da bosuna bekletmeyelim.
      if (!existing.canAskAgain) return null;
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return null;

    const pid = projectId();
    const tokenRes = await Notifications.getExpoPushTokenAsync(
      pid ? { projectId: pid } : undefined
    );
    const token = tokenRes.data;
    if (!token) return null;

    await api.post("/api/push/register", { token, platform: Platform.OS });
    return token;
  } catch {
    // Izin yok, ag yok ya da Expo Go: push olmadan devam.
    return null;
  }
}

/**
 * Cikis yaparken cihazi kullanicidan cozer. Token verilmezse cihazinkini
 * kendisi bulur -- uygulama yeniden acildiginda giristeki token elimizde
 * olmaz, ama cihaz token'i ayni kalir.
 *
 * OTURUM KAPANMADAN once cagrilmali: istek yetkilendirme gerektiriyor.
 */
export async function unregisterPush(token?: string | null) {
  try {
    let t = token ?? null;
    if (!t) {
      if (!Device.isDevice) return;
      const pid = projectId();
      t = (await Notifications.getExpoPushTokenAsync(pid ? { projectId: pid } : undefined))
        .data;
    }
    if (!t) return;
    await api.delete("/api/push/register", { token: t });
  } catch {
    // Onemli degil: sunucu tarafinda gecersiz token zaten temizleniyor.
  }
}

/**
 * Bildirime dokununca ilgili ekrana goturur. Bildirimin data alani
 * sunucudaki notifySafe tarafindan dolduruluyor.
 */
export function routeFromNotification(data: unknown) {
  if (!data || typeof data !== "object") return;
  const d = data as { groupId?: string | null; matchId?: string | null };
  if (d.groupId && d.matchId) router.push(`/group/${d.groupId}/match/${d.matchId}`);
  else if (d.groupId) router.push(`/group/${d.groupId}`);
  else router.push("/bildirimler");
}

/** Dokunma dinleyicisi; kok layout'ta kurulur. */
export function addNotificationTapListener() {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    routeFromNotification(response.notification.request.content.data);
  });
}

// Uygulama KAPALIYKEN bildirime dokunulursa acilis dinleyiciden once olur,
// dinleyici o dokunmayi hic gormez. Son yaniti bir kez okuyup isliyoruz.
// Tek seferlik: kullanici cikip tekrar girerse ayni bildirime geri
// atmayalim.
let initialHandled = false;

export async function consumeInitialNotification() {
  if (initialHandled) return;
  initialHandled = true;
  try {
    const res = await Notifications.getLastNotificationResponseAsync();
    if (res) routeFromNotification(res.notification.request.content.data);
  } catch {
    // Onemli degil.
  }
}
