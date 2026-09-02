import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Button, Card, ErrorText, Field, Label } from "../../../../../components/ui";
import { DateTimeField } from "../../../../../components/DateTimeField";
import { api, ApiError } from "../../../../../lib/api";
import { clockTime, shortDate } from "../../../../../lib/format";
import { border, colors, radius, space, type } from "../../../../../lib/theme";

type Mode = "poll" | "fixed";
type Kind = "ic" | "dis";
type Option = { startsAt: Date; location: string };

export default function NewMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [mode, setMode] = useState<Mode>("fixed");
  const [kind, setKind] = useState<Kind>("ic");
  const [requiredPlayers, setRequiredPlayers] = useState("14");
  const [note, setNote] = useState("");

  // Kesin mac
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [location, setLocation] = useState("");

  // Anket
  const [options, setOptions] = useState<Option[]>([]);
  const [draftDate, setDraftDate] = useState<Date | null>(null);
  const [draftLocation, setDraftLocation] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function addOption() {
    if (!draftDate || !draftLocation.trim()) {
      setError("Seçenek için tarih ve konum gir.");
      return;
    }
    setOptions((prev) => [
      ...prev,
      { startsAt: draftDate, location: draftLocation.trim() },
    ]);
    setDraftDate(null);
    setDraftLocation("");
    setError(null);
  }

  async function submit() {
    setError(null);

    const required = Number(requiredPlayers);
    const body: Record<string, unknown> = {
      mode,
      matchKind: kind,
      requiredPlayers: Number.isFinite(required) && required > 0 ? required : null,
      note: note.trim() || null,
    };

    if (mode === "fixed") {
      if (!startsAt) return setError("Tarih ve saat seçmelisin.");
      if (!location.trim()) return setError("Konum girmelisin.");
      body.scheduledAt = startsAt.toISOString();
      body.location = location.trim();
    } else {
      if (options.length === 0) return setError("En az bir anket seçeneği ekle.");
      body.options = options.map((o) => ({
        startsAt: o.startsAt.toISOString(),
        location: o.location,
      }));
    }

    setSaving(true);
    try {
      await api.post(`/api/groups/${id}/matches`, body);
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Maç oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      contentContainerStyle={{ padding: space[4], gap: space[3] }}
      keyboardShouldPersistTaps="handled"
    >
      <ErrorText>{error}</ErrorText>

      <Card>
        <Label>Maç tipi</Label>
        <View style={s.segmented}>
          <Segment
            label="Kesin maç"
            hint="Bilgiler belli, yoklama alınır"
            active={mode === "fixed"}
            onPress={() => setMode("fixed")}
          />
          <Segment
            label="Anket"
            hint="Gün/saat için oy toplanır"
            active={mode === "poll"}
            onPress={() => setMode("poll")}
          />
        </View>
      </Card>

      <Card>
        <Label>Rakip</Label>
        <View style={s.segmented}>
          <Segment
            label="Takım içi"
            hint="Kendi aramızda"
            active={kind === "ic"}
            onPress={() => setKind("ic")}
          />
          <Segment
            label="Dış rakip"
            hint="Başka takıma karşı"
            active={kind === "dis"}
            onPress={() => setKind("dis")}
          />
        </View>
      </Card>

      {mode === "fixed" ? (
        <Card>
          <Label>Tarih, saat ve konum</Label>
          <DateTimeField value={startsAt} onChange={setStartsAt} />
          <Field
            value={location}
            onChangeText={setLocation}
            placeholder="Örn: Yıldız Halı Saha, Saha 2"
          />
        </Card>
      ) : (
        <Card>
          <Label>Anket seçenekleri</Label>
          <Text style={[type.bodyS, { color: colors.textSecondary, marginBottom: space[3] }]}>
            Her seçenek ayrı bir gün/saat/konum kombinasyonu. Üyeler katılabilecekleri
            seçenekleri işaretler.
          </Text>

          {options.map((o, i) => (
            <View key={i} style={s.optionRow}>
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyMMedium, { color: colors.ink }]}>
                  {shortDate(o.startsAt.toISOString())} ·{" "}
                  {clockTime(o.startsAt.toISOString())}
                </Text>
                <Text style={[type.bodyS, { color: colors.textSecondary }]}>
                  {o.location}
                </Text>
              </View>
              <Pressable
                onPress={() => setOptions((prev) => prev.filter((_, x) => x !== i))}
                hitSlop={8}
              >
                <Feather name="x" size={18} color={colors.stateDanger} />
              </Pressable>
            </View>
          ))}

          <View style={{ marginTop: options.length ? space[3] : 0 }}>
            <DateTimeField value={draftDate} onChange={setDraftDate} />
            <Field
              value={draftLocation}
              onChangeText={setDraftLocation}
              placeholder="Konum"
            />
            <Button
              title="Seçenek ekle"
              variant="secondary"
              size="small"
              onPress={addOption}
            />
          </View>
        </Card>
      )}

      <Card>
        <Label>Gerekli oyuncu sayısı</Label>
        <Field
          value={requiredPlayers}
          onChangeText={setRequiredPlayers}
          keyboardType="number-pad"
          placeholder="14"
        />
        <Label>Not (isteğe bağlı)</Label>
        <Field
          value={note}
          onChangeText={setNote}
          placeholder="Krampon getirin"
          multiline
        />
      </Card>

      <Button
        title={mode === "poll" ? "Anketi başlat" : "Maçı oluştur"}
        onPress={submit}
        loading={saving}
      />
    </ScrollView>
  );
}

function Segment({
  label,
  hint,
  active,
  onPress,
}: {
  label: string;
  hint: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[s.segment, active && s.segmentActive]}>
      <Text
        style={[
          type.bodyMMedium,
          { color: active ? colors.textOnBrand : colors.ink },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          type.bodyS,
          { color: active ? colors.pitch100 : colors.textSecondary },
        ]}
      >
        {hint}
      </Text>
    </Pressable>
  );
}

const s = {
  segmented: {
    flexDirection: "row" as const,
    gap: space[2],
  },
  segment: {
    flex: 1,
    gap: 2,
    padding: space[3],
    borderRadius: radius.button,
    borderWidth: border.width,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surfaceCardRaised,
  },
  segmentActive: {
    backgroundColor: colors.pitch,
    borderColor: colors.pitch,
  },
  optionRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: space[3],
    paddingVertical: space[2] + 2,
    borderBottomWidth: border.width,
    borderBottomColor: colors.borderDefault,
  },
};
