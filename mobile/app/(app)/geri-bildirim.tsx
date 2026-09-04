import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Button, Card, ErrorText, InlineMessage, Label } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { useActiveGroup } from "../../lib/active-group";
import { border, colors, radius, space, type } from "../../lib/theme";

const KINDS = [
  { key: "sorun", label: "Bir sorun var", hint: "Çalışmayan ya da yanlış çalışan bir şey" },
  { key: "oneri", label: "Önerim var", hint: "Eklenmesini veya değişmesini istediğin şey" },
  { key: "diger", label: "Diğer", hint: "Aklındaki başka her şey" },
] as const;

type Kind = (typeof KINDS)[number]["key"];

export default function FeedbackScreen() {
  const { activeGroup } = useActiveGroup();
  const [kind, setKind] = useState<Kind>("sorun");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (message.trim().length < 5) {
      setError("Biraz daha ayrıntı yazar mısın?");
      return;
    }
    setSending(true);
    try {
      await api.post("/api/feedback", {
        kind,
        message: message.trim(),
        groupId: activeGroup?.id ?? null,
        app: "mobil",
      });
      setSent(true);
      setMessage("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      contentContainerStyle={{ padding: space[4], gap: space[3] }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[type.bodyS, { color: colors.textSecondary }]}>
        Takıldığın, bozuk bulduğun ya da eklenmesini istediğin bir şey varsa yaz.
        Doğrudan bize ulaşır.
      </Text>

      {sent && (
        <InlineMessage tone="success">
          Teşekkürler, ulaştı. İstersen bir tane daha yazabilirsin.
        </InlineMessage>
      )}

      <ErrorText>{error}</ErrorText>

      <Card>
        <Label>Ne hakkında?</Label>
        {KINDS.map((k) => {
          const on = kind === k.key;
          return (
            <Pressable
              key={k.key}
              onPress={() => setKind(k.key)}
              style={[s.option, on && s.optionOn]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyMMedium, { color: colors.ink }]}>{k.label}</Text>
                <Text style={[type.bodyS, { color: colors.textSecondary }]}>{k.hint}</Text>
              </View>
              {on && <Text style={{ color: colors.pitch }}>✓</Text>}
            </Pressable>
          );
        })}
      </Card>

      <Card>
        <Label>Mesajın</Label>
        <TextInput
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={6}
          maxLength={2000}
          textAlignVertical="top"
          placeholder="Ne oldu? Mümkünse hangi ekranda olduğunu da yaz."
          placeholderTextColor={colors.textTertiary}
          style={s.textarea}
        />
        <Text style={[type.bodyS, { color: colors.textTertiary }]}>
          {message.length}/2000 · Adın ve e-postan mesajla birlikte iletilir ki
          gerekirse sana dönebilelim.
        </Text>
      </Card>

      <Button title="Gönder" onPress={submit} loading={sending} />
    </ScrollView>
  );
}

const s = {
  option: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: space[3],
    minHeight: 44,
    padding: space[3],
    marginTop: space[2],
    borderRadius: radius.button,
    borderWidth: border.width,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surfaceCardRaised,
  },
  optionOn: {
    borderColor: colors.pitch,
    backgroundColor: colors.pitch100,
  },
  textarea: {
    ...type.bodyM,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceCardRaised,
    borderWidth: border.width,
    borderColor: colors.borderDefault,
    borderRadius: radius.input,
    padding: space[3],
    minHeight: 120,
    marginBottom: space[2],
  },
};
