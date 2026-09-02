import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { monthAndDay } from "../lib/format";
import { border, colors, radius, space, type } from "../lib/theme";

// Gun + saat secici. Bilerek native modul kullanmiyor: native bagimlilik
// eklemek her degisiklikte yeni bir mağaza build'i gerektiriyor, oysa saf JS
// kalinca guncellemeler OTA ile aninda gidebiliyor.
//
// Hali saha maci senaryosuna gore tasarlandi: onumuzdeki birkaç haftadan bir
// gun ve genelde aksam saatlerinden bir saat secilir.

const DAY_COUNT = 21;
const MINUTE_STEP = 15;

export function DateTimeField({
  value,
  onChange,
}: {
  value: Date | null;
  onChange: (date: Date) => void;
}) {
  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: DAY_COUNT }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  // Secim yoksa yarin 21:00 varsayilir; kullanici dokununca netlesir.
  const current = value ?? defaultStart();

  function pickDay(day: Date) {
    const next = new Date(current);
    next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    onChange(next);
  }

  function shiftHour(delta: number) {
    const next = new Date(current);
    next.setHours((next.getHours() + delta + 24) % 24);
    onChange(next);
  }

  function shiftMinute(delta: number) {
    const next = new Date(current);
    const total = next.getHours() * 60 + next.getMinutes() + delta * MINUTE_STEP;
    const wrapped = (total + 24 * 60) % (24 * 60);
    next.setHours(Math.floor(wrapped / 60), wrapped % 60, 0, 0);
    onChange(next);
  }

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  return (
    <View style={{ marginBottom: space[3] }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space[2], paddingVertical: 2 }}
      >
        {days.map((day) => {
          const selected = value != null && isSameDay(day, current);
          return (
            <Pressable
              key={day.toISOString()}
              onPress={() => pickDay(day)}
              style={[s.dayChip, selected && s.dayChipOn]}
            >
              <Text style={[s.dayNumber, selected && { color: colors.textOnBrand }]}>
                {String(day.getDate()).padStart(2, "0")}
              </Text>
              <Text style={[s.dayLabel, selected && { color: colors.pitch100 }]}>
                {monthAndDay(day.toISOString())}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={s.timeRow}>
        <Text style={s.timeLabel}>SAAT</Text>

        <View style={s.stepper}>
          <Pressable onPress={() => shiftHour(-1)} style={s.stepBtn} hitSlop={6}>
            <Text style={s.stepText}>−</Text>
          </Pressable>
          <Text style={s.clock}>{String(current.getHours()).padStart(2, "0")}</Text>
          <Pressable onPress={() => shiftHour(1)} style={s.stepBtn} hitSlop={6}>
            <Text style={s.stepText}>+</Text>
          </Pressable>
        </View>

        <Text style={s.colon}>:</Text>

        <View style={s.stepper}>
          <Pressable onPress={() => shiftMinute(-1)} style={s.stepBtn} hitSlop={6}>
            <Text style={s.stepText}>−</Text>
          </Pressable>
          <Text style={s.clock}>{String(current.getMinutes()).padStart(2, "0")}</Text>
          <Pressable onPress={() => shiftMinute(1)} style={s.stepBtn} hitSlop={6}>
            <Text style={s.stepText}>+</Text>
          </Pressable>
        </View>
      </View>

      {value == null && (
        <Text style={s.hint}>Bir gün seç — saat {clock(current)} olarak başlar.</Text>
      )}
    </View>
  );
}

function clock(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Varsayilan: yarin aksam 21:00 — hali saha maclarinin tipik saati.
function defaultStart() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(21, 0, 0, 0);
  return d;
}

const s = {
  dayChip: {
    alignItems: "center" as const,
    gap: 2,
    minWidth: 62,
    paddingVertical: space[2],
    paddingHorizontal: space[2],
    borderRadius: radius.button,
    borderWidth: border.width,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surfaceCardRaised,
  },
  dayChipOn: {
    backgroundColor: colors.pitch,
    borderColor: colors.pitch,
    borderWidth: border.widthThick,
  },
  dayNumber: {
    ...type.scoreM,
    color: colors.pitch900,
  },
  dayLabel: {
    ...type.labelS,
    textTransform: "uppercase" as const,
    color: colors.textTertiary,
  },
  timeRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: space[2],
    marginTop: space[3],
  },
  timeLabel: {
    ...type.labelS,
    textTransform: "uppercase" as const,
    color: colors.textTertiary,
    marginRight: space[1],
  },
  stepper: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: space[2],
    borderWidth: border.width,
    borderColor: colors.borderDefault,
    borderRadius: radius.button,
    backgroundColor: colors.surfaceCardRaised,
    paddingHorizontal: space[2],
    paddingVertical: space[1],
  },
  stepBtn: {
    paddingHorizontal: space[2],
    paddingVertical: space[1],
  },
  stepText: {
    ...type.displayS,
    color: colors.pitch,
  },
  clock: {
    ...type.scoreM,
    color: colors.ink,
    minWidth: 30,
    textAlign: "center" as const,
  },
  colon: {
    ...type.scoreM,
    color: colors.ink300,
  },
  hint: {
    ...type.bodyS,
    color: colors.textSecondary,
    marginTop: space[2],
  },
};
