import { Link, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { Button, ErrorText, Field, Label, Screen, Title } from "../components/ui";
import { useAuth } from "../lib/auth-context";
import { ApiError } from "../lib/api";
import { brand } from "../lib/brand";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Giriş sırasında hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Screen>
          <View style={{ flex: 1, justifyContent: "center" }}>
            <Title>{brand.name}&apos;ya giriş yap</Title>
            <ErrorText>{error}</ErrorText>

            <Label>E-posta</Label>
            <Field
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="ornek@eposta.com"
            />

            <Label>Şifre</Label>
            <Field
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
            />

            <Button title="Giriş yap" onPress={onSubmit} loading={loading} />

            <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 16 }}>
              <Text>Hesabın yok mu? </Text>
              <Link href="/register" style={{ fontWeight: "600" }}>
                Kayıt ol
              </Link>
            </View>
          </View>
        </Screen>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
