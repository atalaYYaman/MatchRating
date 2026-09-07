import * as Application from "expo-application";
import * as Device from "expo-device";
import { useCallback, useEffect, useState } from "react";
import { Linking, Platform, ScrollView, Text, View } from "react-native";
import { Button, Card, InlineMessage } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import {
  PUSH_STATUS_LABEL,
  PushStatus,
  registerForPush,
} from "../../lib/push";
import { border, colors, space, type } from "../../lib/theme";

// Bildirim Durumu.
//
// Push zincirinin nerede durdugunu telefonun kendisinde gosterir. Bunu
// eklememizin sebebi somut: cihaz tablosu aylarca bos kaldi ve kimse
// bunu fark etmedi, cunku kayit hatalari sessizce yutuluyordu. Test
// ederken "gelmiyor" demek yetmiyor; NEDEN gelmedigini okuyabilmek
// gerekiyor.
//
// Ekranin isi teshis: her satir tek bir soruyu yanitliyor ve destege
// oldugu gibi okunabiliyor.

type TestResult = {
  ok: boolean;
  devices: number;
  sent?: number;
  platforms?: (string | null)[];
  error?: string;
};

export default function PushStatusScreen() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const check = useCallback(async () => {
    setChecking(true);
    setStatus(await registerForPush());
    setChecking(false);
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  async function sendTest() {
    setTesting(true);
    setTestError(null);
    setResult(null);
    try {
      setResult(await api.post<TestResult>("/api/push/test", {}));
    } catch (err) {
      // 409 govdesi de bilgi tasiyor: kayitli cihaz yok demek.
      setTestError(
        err instanceof ApiError ? err.message : "Test bildirimi gönderilemedi."
      );
    } finally {
      setTesting(false);
    }
  }

  const ready = status?.state === "hazir";

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Card raised>
        <Text style={styles.label}>DURUM</Text>
        <Text style={styles.headline}>
          {checking
            ? "Kontrol ediliyor…"
            : status
              ? PUSH_STATUS_LABEL[status.state]
              : "Bilinmiyor"}
        </Text>
        {status ? <Explanation status={status} /> : null}
      </Card>

      {ready ? (
        <Card>
          <Text style={styles.label}>TEST</Text>
          <Text style={styles.body}>
            Kendi telefonuna bir bildirim gönderir. Uygulamayı kapatıp
            denemek, kilit ekranında da göründüğünü doğrular.
          </Text>
          <View style={styles.action}>
            <Button
              title="Test bildirimi gönder"
              onPress={sendTest}
              loading={testing}
            />
          </View>
          {result ? (
            <InlineMessage tone={result.ok ? "success" : "danger"}>
              {result.ok
                ? `Gönderildi · ${result.sent}/${result.devices} cihaz`
                : (result.error ?? "Gönderilemedi.")}
            </InlineMessage>
          ) : null}
          {testError ? (
            <InlineMessage tone="danger">{testError}</InlineMessage>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <Text style={styles.label}>CİHAZ</Text>
        <Row k="Model" v={Device.modelName ?? "—"} />
        <Row
          k="Android sürümü"
          v={Platform.OS === "android" ? (Device.osVersion ?? "—") : Platform.OS}
        />
        <Row k="Uygulama" v={Application.nativeApplicationVersion ?? "—"} />
        <Row k="Yapı" v={Application.nativeBuildVersion ?? "—"} />
        <Row
          k="Cihaz kaydı"
          v={ready ? "Sunucuda kayıtlı" : "Kayıtlı değil"}
        />
      </Card>

      <Text style={styles.footnote}>
        Bu ekranı destek isterken olduğu gibi ekran görüntüsü alarak
        paylaşabilirsin.
      </Text>
    </ScrollView>
  );
}

function Explanation({ status }: { status: PushStatus }) {
  switch (status.state) {
    case "hazir":
      return (
        <>
          <Text style={styles.body}>
            Bu cihaz sunucuda kayıtlı. Maç açıldığında, tarih kesinleştiğinde
            ve puanlama başladığında bildirim gelir.
          </Text>
          <Text style={styles.mono} selectable>
            {status.token}
          </Text>
        </>
      );

    case "izin-yok":
      return (
        <>
          <Text style={styles.body}>
            {status.canAskAgain
              ? "Bildirim izni verilmedi. Tekrar sorulabilir."
              : "Bildirim izni kapatılmış. Sistem artık sormuyor, ayarlardan açman gerekiyor."}
          </Text>
          <View style={styles.action}>
            <Button
              title="Uygulama ayarlarını aç"
              variant="secondary"
              onPress={() => Linking.openSettings()}
            />
          </View>
        </>
      );

    case "emulator":
      return (
        <Text style={styles.body}>
          Emülatörde push token üretilemiyor. Gerçek bir telefonda dene.
        </Text>
      );

    case "token-alinamadi":
      return (
        <>
          <Text style={styles.body}>
            İzin var ama cihaz Firebase&apos;e kaydolamadı. Genellikle
            uygulamanın bu sürümünde Firebase yapılandırması eksik demektir;
            güncel sürüme geçmek gerekebilir.
          </Text>
          <Text style={styles.mono} selectable>
            {status.error}
          </Text>
        </>
      );

    case "sunucuya-yazilamadi":
      return (
        <>
          <Text style={styles.body}>
            Cihaz kaydı alındı ama sunucuya yazılamadı. İnternet bağlantını
            kontrol edip bu ekranı yeniden aç.
          </Text>
          <Text style={styles.mono} selectable>
            {status.error}
          </Text>
        </>
      );
  }
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowKey}>{k}</Text>
      <Text style={styles.rowValue}>{v}</Text>
    </View>
  );
}

const styles = {
  page: {
    padding: space[3],
    gap: space[3],
    paddingBottom: space[5],
  },
  label: {
    ...type.labelS,
    textTransform: "uppercase" as const,
    color: colors.textTertiary,
    marginBottom: space[2],
  },
  headline: {
    ...type.displayS,
    color: colors.textPrimary,
    marginBottom: space[2],
  },
  body: {
    ...type.bodyM,
    color: colors.textSecondary,
  },
  mono: {
    fontFamily: Platform.OS === "android" ? "monospace" : "Menlo",
    fontSize: 12,
    lineHeight: 18,
    color: colors.textTertiary,
    marginTop: space[2],
  },
  action: {
    marginTop: space[3],
  },
  row: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingVertical: space[2] + 2,
    borderBottomWidth: border.width,
    borderBottomColor: colors.borderDefault,
    gap: space[3],
  },
  rowKey: {
    ...type.bodyM,
    color: colors.textSecondary,
  },
  rowValue: {
    ...type.bodyM,
    color: colors.textPrimary,
    flexShrink: 1,
    textAlign: "right" as const,
  },
  footnote: {
    ...type.bodyS,
    color: colors.textTertiary,
    paddingHorizontal: space[1],
  },
};
