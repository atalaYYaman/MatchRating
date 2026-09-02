import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { border, colors, radius, space, type } from "../lib/theme";

// MatchRating tasarim sistemi bilesenlerinin React Native karsiligi.
// Kaynak: Claude Design > MatchRating Design System > components/
// Kural: golge yok, her yuzey 1px hairline kenarlikla tanimli.

export function Screen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Card({
  children,
  raised,
  style,
}: {
  children: React.ReactNode;
  /** Chalk zemin uzerine binen yuzeyler beyaz olur. */
  raised?: boolean;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.card, raised && styles.cardRaised, style]}>{children}</View>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

/** Skorbord tarzi, buyuk harf, harf araligi acilmis ust baslik. */
export function Eyebrow({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: TextStyle;
}) {
  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function ErrorText({ children }: { children: string | null }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function Field({ error, ...props }: TextInputProps & { error?: string }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View>
      <TextInput
        style={[styles.field, focused && styles.fieldFocused]}
        placeholderTextColor={colors.textTertiary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "accent";

export function Button({
  title,
  onPress,
  loading,
  variant = "primary",
  size = "default",
  disabled,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: ButtonVariant;
  size?: "default" | "small";
  disabled?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        size === "small" && styles.buttonSmall,
        buttonVariants[variant].container,
        isDisabled && styles.buttonDisabled,
        // Tasarim sistemi: basiliyken renk degil, hafif kucultme.
        pressed && !isDisabled && { transform: [{ scale: 0.98 }] },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={buttonVariants[variant].label.color} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            size === "small" && styles.buttonTextSmall,
            buttonVariants[variant].label,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

type BadgeTone = "neutral" | "brand" | "accent" | "danger";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <View style={[styles.badge, badgeTones[tone].container]}>
      <Text style={[styles.badgeText, badgeTones[tone].label]}>{children}</Text>
    </View>
  );
}

/** Uygulamanin her yerindeki ham puanlara skorbord gorunumu verir. */
export function ScoreBadge({
  value,
  label = "GENEL",
  size = "default",
}: {
  value: string | number;
  label?: string;
  size?: "default" | "large";
}) {
  const big = size === "large";
  return (
    <View style={[styles.scoreBadge, big && styles.scoreBadgeLarge]}>
      <Text style={big ? styles.scoreValueLarge : styles.scoreValue}>{value}</Text>
      <Text style={styles.scoreLabel}>{label}</Text>
    </View>
  );
}

export function InlineMessage({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "danger";
}) {
  const toneStyle = inlineTones[tone];
  return (
    <View style={[styles.inline, toneStyle.container]}>
      <Text style={[styles.inlineText, toneStyle.label]}>{children}</Text>
    </View>
  );
}

/** Kartlar icindeki hairline ayirici. */
export function Divider({ style }: { style?: ViewStyle }) {
  return <View style={[styles.divider, style]} />;
}

const buttonVariants: Record<
  ButtonVariant,
  { container: ViewStyle; label: TextStyle }
> = {
  primary: {
    container: { backgroundColor: colors.pitch, borderColor: colors.pitch },
    label: { color: colors.textOnBrand },
  },
  secondary: {
    container: {
      backgroundColor: colors.surfaceCard,
      borderColor: colors.borderDefault,
    },
    label: { color: colors.textPrimary },
  },
  danger: {
    container: { backgroundColor: colors.brick, borderColor: colors.brick },
    label: { color: colors.textOnBrand },
  },
  accent: {
    container: { backgroundColor: colors.amber, borderColor: colors.amber },
    label: { color: colors.textOnAccent },
  },
};

const badgeTones: Record<BadgeTone, { container: ViewStyle; label: TextStyle }> = {
  neutral: {
    container: { backgroundColor: colors.chalk200 },
    label: { color: colors.ink500 },
  },
  brand: {
    container: { backgroundColor: colors.pitch100 },
    label: { color: colors.pitch900 },
  },
  accent: {
    container: { backgroundColor: colors.amber100 },
    label: { color: colors.amber700 },
  },
  danger: {
    container: { backgroundColor: colors.brick100 },
    label: { color: colors.brick },
  },
};

const inlineTones = {
  neutral: {
    container: { backgroundColor: colors.chalk200, borderColor: colors.borderDefault },
    label: { color: colors.ink700 },
  },
  success: {
    container: { backgroundColor: colors.pitch100, borderColor: colors.pitch300 },
    label: { color: colors.pitch900 },
  },
  danger: {
    container: { backgroundColor: colors.brick100, borderColor: colors.brick },
    label: { color: colors.brick },
  },
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfacePage,
    padding: space[4],
  },
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.card,
    padding: space[4],
    marginBottom: space[3],
    borderWidth: border.width,
    borderColor: colors.borderDefault,
  },
  cardRaised: {
    backgroundColor: colors.surfaceCardRaised,
    borderWidth: border.widthThick,
    borderColor: colors.borderStrong,
  },
  title: {
    ...type.displayM,
    color: colors.textPrimary,
    marginBottom: space[3],
  },
  eyebrow: {
    ...type.labelS,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  label: {
    ...type.labelS,
    textTransform: "uppercase",
    color: colors.textSecondary,
    marginBottom: space[2],
  },
  error: {
    ...type.bodyS,
    color: colors.stateDanger,
    marginBottom: space[2],
  },
  field: {
    ...type.bodyM,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceCardRaised,
    borderWidth: border.width,
    borderColor: colors.borderDefault,
    borderRadius: radius.input,
    paddingHorizontal: space[3] + 2,
    paddingVertical: space[3] - 2,
    marginBottom: space[4],
  },
  fieldFocused: {
    borderColor: colors.pitch,
  },
  fieldError: {
    ...type.bodyS,
    color: colors.stateDanger,
    marginTop: -space[3],
    marginBottom: space[3],
  },
  button: {
    borderRadius: radius.button,
    borderWidth: border.width,
    paddingVertical: space[3],
    paddingHorizontal: space[5],
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  buttonSmall: {
    paddingVertical: space[2],
    paddingHorizontal: space[3] + 2,
    minHeight: 34,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    ...type.bodyM,
    fontFamily: "PublicSans_600SemiBold",
  },
  buttonTextSmall: {
    fontSize: 13,
  },
  badge: {
    alignSelf: "flex-start",
    paddingVertical: space[1],
    paddingHorizontal: space[2] + 2,
    borderRadius: radius.pill,
  },
  badgeText: {
    ...type.labelS,
    textTransform: "uppercase",
  },
  scoreBadge: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    backgroundColor: colors.surfaceCardRaised,
    borderWidth: border.widthThick,
    borderColor: colors.borderStrong,
    borderRadius: radius.chip,
    paddingVertical: space[2] - 2,
    paddingHorizontal: space[3],
    minWidth: 56,
  },
  scoreBadgeLarge: {
    paddingVertical: space[2] + 2,
    paddingHorizontal: space[4],
    minWidth: 76,
  },
  scoreValue: {
    ...type.scoreM,
    color: colors.pitch900,
  },
  scoreValueLarge: {
    ...type.scoreL,
    color: colors.pitch900,
  },
  scoreLabel: {
    ...type.labelS,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  inline: {
    borderWidth: border.width,
    borderRadius: radius.card,
    padding: space[3],
    marginBottom: space[3],
  },
  inlineText: {
    ...type.bodyS,
  },
  divider: {
    height: border.width,
    backgroundColor: colors.borderDefault,
  },
});
