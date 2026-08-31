import { Link, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { Button, ErrorText, Field, Label, Screen, Title } from "../components/ui";
import { useAuth } from "../lib/auth-context";
import { ApiError } from "../lib/api";

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kayıt sırasında hata oluştu.");
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
            <Title>Hesap oluştur</Title>
            <ErrorText>{error}</ErrorText>

            <Label>İsim</Label>
            <Field value={name} onChangeText={setName} placeholder="Adın Soyadın" />

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
              placeholder="En az 6 karakter"
            />

            <Button title="Kayıt ol" onPress={onSubmit} loading={loading} />

            <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 16 }}>
              <Text>Zaten hesabın var mı? </Text>
              <Link href="/login" style={{ fontWeight: "600" }}>
                Giriş yap
              </Link>
            </View>
          </View>
        </Screen>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
