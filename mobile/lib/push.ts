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
// hicbir hata uygulamayi durdurmaz.
//
// Ama SESSIZ de kalmamali. Ilk surumde her hata tek bir catch'te
// yutuluyordu; izin reddi, FCM kurulumunun eksikligi ve ag hatasi ayni
// sonucu veriyordu: hicbir sey. Cihaz tablosu bos kaldi ve bunu aylarca
// kimse fark etmedi. Artik her durak kendi durumunu donduruyor, Bildirim
// Durumu ekrani da bunu oldugu gibi gosteriyor.

/** Kayit zincirinin nerede durdugunu anlatir. */
export type PushStatus =
  /** Cihaz kayitli, bildirim gelebilir. */
  | { state: "hazir"; token: string }
  /** Kullanici izin vermedi. canAskAgain false ise yalnizca sistem ayarlarindan acilir. */
  | { state: "izin-yok"; canAskAgain: boolean }
  /** Emulator: Google Play Services yok, token uretilemiyor. */
  | { state: "emulator" }
  /** Izin var ama token alinamadi. Genellikle FCM kurulumu eksik demek. */
  | { state: "token-alinamadi"; error: string }
  /** Token alindi ama sunucuya yazilamadi; ag ya da oturum sorunu. */
  | { state: "sunucuya-yazilamadi"; token: string; error: string };

export const PUSH_STATUS_LABEL: Record<PushStatus["state"], string> = {
  hazir: "Bildirimler açık",
  "izin-yok": "Bildirim izni verilmedi",
  emulator: "Emülatörde çalışmaz",
  "token-alinamadi": "Cihaz kaydı alınamadı",
  "sunucuya-yazilamadi": "Sunucuya yazılamadı",
};

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

function reason(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// Son durum: Bildirim Durumu ekrani yeniden kayit denemeden de okuyabilsin.
let lastStatus: PushStatus | null = null;
export function lastPushStatus(): PushStatus | null {
  return lastStatus;
}

/**
 * Izin ister, token alir ve sunucuya kaydeder.
 * Giris yapildiktan SONRA cagrilmali: token kullaniciya baglaniyor.
 *
 * Idempotent: tekrar cagirmak zararsiz, sunucuda ON CONFLICT ile
 * guncelleniyor. Bildirim Durumu ekrani bunu yeniden dener.
 */
export async function registerForPush(): Promise<PushStatus> {
  const status = await attemptRegister();
  lastStatus = status;
  if (status.state !== "hazir") {
    console.warn("[push] kayit tamamlanmadi:", JSON.stringify(status));
  }
  return status;
}

async function attemptRegister(): Promise<PushStatus> {
  // Emulatorde push token uretilemiyor; denemek hata firlatiyor.
  if (!Device.isDevice) return { state: "emulator" };

  if (Platform.OS === "android") {
    // Android 8+ kanal olmadan bildirim gostermiyor. Ayrica Android 13'te
    // izin istemi ilk kanal olusana kadar cikmiyor, o yuzden izinden once.
    try {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Genel",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#1F5C3F",
      });
    } catch (err) {
      // Kanal kurulamazsa da devam: token yine alinabilir.
      console.warn("[push] kanal olusturulamadi:", reason(err));
    }
  }

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted) {
    // Reddedildiyse sistem zaten tekrar sormuyor; kullaniciyi da bosuna
    // bekletmeyelim, ayarlara yonlendirmek Bildirim Durumu ekraninin isi.
    if (!existing.canAskAgain) return { state: "izin-yok", canAskAgain: false };
    granted = (await Notifications.requestPermissionsAsync()).granted;
  }
  if (!granted) return { state: "izin-yok", canAskAgain: true };

  let token: string;
  try {
    const pid = projectId();
    const res = await Notifications.getExpoPushTokenAsync(
      pid ? { projectId: pid } : undefined
    );
    token = res.data;
  } catch (err) {
    // Buranin en sik sebebi: google-services.json derlemede yok ya da
    // FCM kimlik bilgileri EAS'e yuklenmemis. Mesaji oldugu gibi
    // tasiyoruz, tahmin etmiyoruz.
    return { state: "token-alinamadi", error: reason(err) };
  }
  if (!token) {
    return { state: "token-alinamadi", error: "Expo bos token dondurdu." };
  }

  try {
    await api.post("/api/push/register", { token, platform: Platform.OS });
  } catch (err) {
    return { state: "sunucuya-yazilamadi", token, error: reason(err) };
  }

  return { state: "hazir", token };
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
  } catch (err) {
    // Onemli degil: sunucu tarafinda gecersiz token zaten temizleniyor.
    console.warn("[push] kayit cozulemedi:", reason(err));
  } finally {
    lastStatus = null;
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
