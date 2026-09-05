import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import {
  Button,
  ErrorText,
  Field,
  InlineMessage,
  Label,
  Screen,
  Title,
} from "../components/ui";
import { api, ApiError } from "../lib/api";
import { colors, space, type } from "../lib/theme";

// Sifre sifirlama linki e-postayla gelir ve web'de acilir; mobilin isi
// istegi baslatmak. Bu ekran giris ekranindan erisilir, oturum gerektirmez.
export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!email.trim()) {
      setError("E-posta girin.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/api/auth/password/request", { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.surfacePage }}
        keyboardShouldPersistTaps="handled"
      >
        <Screen>
          <Title>Şifremi unuttum</Title>

          {sent ? (
            <>
              <InlineMessage tone="success">
                Bu adres kayıtlıysa şifre sıfırlama bağlantısı gönderildi. Gelen
                kutunu kontrol et; bağlantı 1 saat geçerli.
              </InlineMessage>
              <Button
                title="Girişe dön"
                variant="secondary"
                onPress={() => router.replace("/login")}
              />
            </>
          ) : (
            <>
              <Text
                style={[
                  type.bodyS,
                  { color: colors.textSecondary, marginBottom: space[4] },
                ]}
              >
                Hesabının e-posta adresini yaz, sıfırlama bağlantısı gönderelim.
                Bağlantı tarayıcıda açılır.
              </Text>

              <ErrorText>{error}</ErrorText>

              <Label>E-posta</Label>
              <Field
                value={email}
                onChangeText={setEmail}
                placeholder="ornek@eposta.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />

              <Button
                title="Sıfırlama bağlantısı gönder"
                onPress={submit}
                loading={busy}
              />

              <View style={{ marginTop: space[3] }}>
                <Button
                  title="Vazgeç"
                  variant="secondary"
                  onPress={() => router.replace("/login")}
                />
              </View>
            </>
          )}
        </Screen>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
