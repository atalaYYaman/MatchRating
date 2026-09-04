import { Text, View } from "react-native";
import { MatchPhase, PHASE_LABEL } from "../lib/constants";
import { border, colors, radius, space, type } from "../lib/theme";

// Her fazin kendine ait bir dolgu agirligi var, boylece listede goz atarken
// ayirt edilebiliyorlar. Amber bilerek kullanilmiyor: o renk yalnizca
// "senden bir sey bekleniyor" anlamina ayrildi (bkz. myAction).
//
// Webdeki components/PhaseBadge.tsx ile ayni gorsel dil.
const PHASE_STYLE: Record<
  MatchPhase,
  { bg: string; fg: string; borderColor?: string; dot?: boolean }
> = {
  // Anket acik: henuz kesinlesmemis -> dolgusuz, yalniz cerceve.
  poll: { bg: "transparent", fg: colors.pitch, borderColor: colors.pitch },
  // Planlandi: sabit ama sakin -> yumusak dolgu.
  scheduled: { bg: colors.pitch100, fg: colors.pitch900 },
  // Oynaniyor: su anda oluyor -> en yuksek sesli, dolu yesil + canli nokta.
  playing: { bg: colors.pitch, fg: colors.textOnBrand, dot: true },
  // Puanlaniyor: skorbord motifi -> koyu ink dolgu.
  rating: { bg: colors.ink, fg: colors.chalk100 },
  completed: { bg: colors.chalk200, fg: colors.ink500 },
  cancelled: { bg: colors.brick100, fg: colors.brick },
};

export function PhaseBadge({ phase }: { phase: MatchPhase }) {
  const s = PHASE_STYLE[phase];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: space[1] + 2,
        paddingVertical: space[1],
        paddingHorizontal: space[2] + 2,
        borderRadius: radius.pill,
        backgroundColor: s.bg,
        borderWidth: s.borderColor ? 1.5 : 0,
        borderColor: s.borderColor ?? "transparent",
      }}
    >
      {s.dot && (
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            backgroundColor: s.fg,
          }}
        />
      )}
      <Text style={[type.labelS, { textTransform: "uppercase", color: s.fg }]}>
        {PHASE_LABEL[phase]}
      </Text>
    </View>
  );
}
