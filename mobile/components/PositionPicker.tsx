import { Pressable, Text, View } from "react-native";
import { POSITIONS, PositionKey } from "../lib/constants";
import { border, colors, radius, space, type } from "../lib/theme";

// Webdeki davranisin aynisi: ilk dokunus birincil, ikincisi ikincil mevki;
// secili olana tekrar dokunmak geri alir.
export function selectPosition(
  key: PositionKey,
  primary: PositionKey | "",
  secondary: PositionKey | ""
): { primary: PositionKey | ""; secondary: PositionKey | "" } {
  if (primary === key) return { primary: secondary, secondary: "" };
  if (secondary === key) return { primary, secondary: "" };
  if (!primary) return { primary: key, secondary };
  return { primary, secondary: key };
}

export function PositionPicker({
  primary,
  secondary,
  onChange,
}: {
  primary: PositionKey | "";
  secondary: PositionKey | "";
  onChange: (next: { primary: PositionKey | ""; secondary: PositionKey | "" }) => void;
}) {
  return (
    <View style={styles.chips}>
      {POSITIONS.map((p) => {
        const isPrimary = primary === p.key;
        const isSecondary = secondary === p.key;
        const on = isPrimary || isSecondary;
        return (
          <Pressable
            key={p.key}
            onPress={() => onChange(selectPosition(p.key, primary, secondary))}
            style={[
              styles.chip,
              isPrimary && styles.chipPrimary,
              isSecondary && styles.chipSecondary,
            ]}
          >
            <Text
              style={[
                type.bodySMedium,
                { color: isPrimary ? colors.textOnBrand : on ? colors.pitch900 : colors.ink },
              ]}
            >
              {p.label}
              {isPrimary ? " (1.)" : isSecondary ? " (2.)" : ""}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = {
  chips: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: space[2],
    marginBottom: space[3],
  },
  chip: {
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    borderRadius: radius.pill,
    borderWidth: border.width,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surfaceCard,
  },
  chipPrimary: {
    backgroundColor: colors.pitch,
    borderColor: colors.pitch,
  },
  chipSecondary: {
    backgroundColor: colors.pitch100,
    borderColor: colors.pitch300,
  },
};
