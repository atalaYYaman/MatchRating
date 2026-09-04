import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useActiveGroup } from "../lib/active-group";
import { border, colors, radius, space, type } from "../lib/theme";
import { Badge } from "./ui";

// Sol ustteki takim kapsami secici. Ana sayfa ve Maclar sekmesinde ayni
// bilesen kullanilir; secim ortak context'te tutuldugu icin sekmeler arasi
// gecerken korunur. Web'deki components/TeamSwitcher.tsx ile ayni davranis.
export function TeamSwitcher({
  eyebrow = "MATCHRATING · TAKIM",
}: {
  eyebrow?: string;
}) {
  const { groups, activeGroup, isAll, setScope } = useActiveGroup();
  const [open, setOpen] = useState(false);

  const label = isAll ? "Tüm takımlar" : (activeGroup?.name ?? "Takım seç");

  return (
    <View>
      <Text style={s.eyebrow}>{eyebrow}</Text>
      <Pressable onPress={() => setOpen((v) => !v)} style={s.switch}>
        <Text style={[type.displayS, { color: colors.ink }]} numberOfLines={1}>
          {label}
        </Text>
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.ink300}
        />
      </Pressable>

      {open && (
        <View style={s.sheet}>
          <Pressable
            onPress={() => {
              setScope(null);
              setOpen(false);
            }}
            style={[s.row, groups.length > 0 && s.rowBorder]}
          >
            <Text style={[type.bodyM, { color: colors.ink }]}>Tüm takımlar</Text>
            {isAll && <Badge tone="brand">Aktif</Badge>}
          </Pressable>

          {groups.map((g, i) => (
            <Pressable
              key={g.id}
              onPress={() => {
                setScope(g.id);
                setOpen(false);
              }}
              style={[s.row, i < groups.length - 1 && s.rowBorder]}
            >
              <Text style={[type.bodyM, { color: colors.ink }]}>{g.name}</Text>
              {g.id === activeGroup?.id && <Badge tone="brand">Aktif</Badge>}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const s = {
  eyebrow: {
    ...type.labelS,
    textTransform: "uppercase" as const,
    color: colors.ink300,
  },
  // Uygulamanin tamaminin kapsamini belirleyen kontrol; dokunulabilir
  // gorunmesi ve tam boy hedef olmasi gerekiyor (Apple HIG 44pt).
  switch: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    alignSelf: "flex-start" as const,
    gap: space[2],
    marginTop: 3,
    minHeight: 44,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderWidth: border.width,
    borderColor: colors.borderDefault,
    borderRadius: radius.button,
    backgroundColor: colors.surfaceCard,
  },
  sheet: {
    marginTop: space[2],
    backgroundColor: colors.surfaceCardRaised,
    borderWidth: border.widthThick,
    borderColor: colors.borderStrong,
    borderRadius: radius.card,
    overflow: "hidden" as const,
  },
  row: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  rowBorder: {
    borderBottomWidth: border.width,
    borderBottomColor: colors.borderDefault,
  },
};
