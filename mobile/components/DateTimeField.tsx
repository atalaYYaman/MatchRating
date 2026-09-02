import DateTimePicker from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { clockTime, shortDate } from "../lib/format";
import { border, colors, radius, space, type } from "../lib/theme";

// Gun ve saati iki adimda secen alan. Android'de picker modal olarak acilir,
// once tarih sonra saat sorulur.
export function DateTimeField({
  value,
  onChange,
}: {
  value: Date | null;
  onChange: (date: Date) => void;
}) {
  const [mode, setMode] = useState<"date" | "time" | null>(null);
  const [draft, setDraft] = useState<Date | null>(null);

  function open() {
    setDraft(value ?? defaultStart());
    setMode("date");
  }

  return (
    <View>
      <Pressable onPress={open} style={s.field}>
        <Feather name="calendar" size={16} color={colors.ink300} />
        <Text
          style={[
            type.bodyM,
            { color: value ? colors.textPrimary : colors.textTertiary, flex: 1 },
          ]}
        >
          {value
            ? `${shortDate(value.toISOString())} · ${clockTime(value.toISOString())}`
            : "Tarih ve saat seç"}
        </Text>
      </Pressable>

      {mode && (
        <DateTimePicker
          value={draft ?? defaultStart()}
          mode={mode}
          is24Hour
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selected) => {
            if (event.type === "dismissed" || !selected) {
              setMode(null);
              return;
            }
            if (mode === "date") {
              // Tarih secildi; simdi saati sor.
              const next = new Date(draft ?? defaultStart());
              next.setFullYear(
                selected.getFullYear(),
                selected.getMonth(),
                selected.getDate()
              );
              setDraft(next);
              setMode("time");
              return;
            }
            const final = new Date(draft ?? defaultStart());
            final.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
            setMode(null);
            onChange(final);
          }}
        />
      )}
    </View>
  );
}

// Varsayilan: yarin aksam 21:00 — hali saha maclarinin tipik saati.
function defaultStart() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(21, 0, 0, 0);
  return d;
}

const s = {
  field: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: space[2],
    backgroundColor: colors.surfaceCardRaised,
    borderWidth: border.width,
    borderColor: colors.borderDefault,
    borderRadius: radius.input,
    paddingHorizontal: space[3] + 2,
    paddingVertical: space[3],
    marginBottom: space[3],
  },
};
