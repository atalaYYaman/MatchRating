import Slider from "@react-native-community/slider";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import {
  Badge,
  Button,
  Card,
  ErrorText,
  ScoreBadge,
} from "../../../../../../components/ui";
import { api, ApiError } from "../../../../../../lib/api";
import { SKILLS, SkillKey } from "../../../../../../lib/constants";
import { border, colors, radius, space, type } from "../../../../../../lib/theme";

type Detail = {
  rating: {
    open: boolean;
    played: boolean;
    participants: { id: string; name: string }[];
    // Kendin haric puanlanacak oyuncular (sunucu ayiriyor).
    targets: { id: string; name: string }[];
    myRatings: {
      target_id: string;
      score: number;
      strength_skill: string;
      weakness_skill: string;
    }[];
  };
};

type Draft = {
  score: number;
  strength: SkillKey | null;
  weakness: SkillKey | null;
};

const NEUTRAL = 5;

export default function RateMatchScreen() {
  const { id, matchId } = useLocalSearchParams<{ id: string; matchId: string }>();

  const [participants, setParticipants] = useState<{ id: string; name: string }[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Detail>(`/api/groups/${id}/matches/${matchId}`);
      const rated = new Set(res.rating.myRatings.map((r) => r.target_id));
      setParticipants(res.rating.targets);
      setDone(rated);

      // Daha once puanladiklarim formda gorunsun ki duzeltilebilsin.
      const initial: Record<string, Draft> = {};
      for (const p of res.rating.targets) {
        const mine = res.rating.myRatings.find((r) => r.target_id === p.id);
        initial[p.id] = mine
          ? {
              score: Number(mine.score),
              strength: mine.strength_skill as SkillKey,
              weakness: mine.weakness_skill as SkillKey,
            }
          : { score: NEUTRAL, strength: null, weakness: null };
      }
      setDrafts(initial);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Yüklenemedi.");
    }
  }, [id, matchId]);

  useEffect(() => {
    load();
  }, [load]);

  function update(targetId: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [targetId]: { ...prev[targetId], ...patch } }));
  }

  async function submit() {
    const payload = Object.entries(drafts)
      .filter(([, d]) => d.strength && d.weakness)
      .map(([targetId, d]) => ({
        targetId,
        score: d.score,
        strengthSkill: d.strength,
        weaknessSkill: d.weakness,
      }));

    if (payload.length === 0) {
      setError("En az bir oyuncu için güçlü ve zayıf yön seç.");
      return;
    }

    Alert.alert(
      "Puanları gönder",
      `${payload.length} oyuncu için puanın gönderilecek. Puanlar bir kez verilir, sonradan değiştiremezsin.`,
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Gönder", onPress: () => send(payload) },
      ]
    );
  }

  async function send(payload: unknown[]) {
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/groups/${id}/matches/${matchId}/ratings`, {
        ratings: payload,
      });
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Puanlama kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      contentContainerStyle={{ padding: space[4], gap: space[3] }}
    >
      <Card>
        <Text style={[type.bodyS, { color: colors.textSecondary }]}>
          Her oyuncuya 10 üzerinden puan ver ve maçta öne çıkan bir güçlü, bir zayıf
          yönünü seç. 5 nötr kabul edilir: 5&apos;in üstü güçlü yönü yükseltir, altı
          zayıf yönü düşürür.
        </Text>
        <Text
          style={[
            type.bodySMedium,
            { color: colors.stateDanger, marginTop: space[3] },
          ]}
        >
          Puanlar bir kez verilir; gönderdikten sonra değiştiremezsin.
        </Text>
      </Card>

      <ErrorText>{error}</ErrorText>

      {participants.map((p) => {
        const d = drafts[p.id];
        if (!d) return null;
        const diff = d.score - NEUTRAL;
        return (
          <Card key={p.id} raised>
            <View style={s.head}>
              <View style={{ flex: 1 }}>
                <Text style={[type.displayS, { color: colors.ink }]}>{p.name}</Text>
                {done.has(p.id) && <Badge tone="brand">Puanladın</Badge>}
              </View>
              <ScoreBadge value={d.score.toFixed(1)} label="MAÇ" />
            </View>

            <Slider
              minimumValue={0}
              maximumValue={10}
              step={0.5}
              value={d.score}
              onValueChange={(v) => update(p.id, { score: v })}
              minimumTrackTintColor={
                diff > 0 ? colors.pitch : diff < 0 ? colors.brick : colors.ink300
              }
              maximumTrackTintColor={colors.chalk300}
              thumbTintColor={colors.pitch}
              style={{ marginVertical: space[2] }}
            />

            <Text style={s.eyebrow}>ÖNE ÇIKAN YÖNÜ</Text>
            <SkillPicker
              selected={d.strength}
              exclude={d.weakness}
              tone="strength"
              onSelect={(k) => update(p.id, { strength: k })}
            />

            <Text style={[s.eyebrow, { marginTop: space[3] }]}>ZAYIF KALDIĞI YÖN</Text>
            <SkillPicker
              selected={d.weakness}
              exclude={d.strength}
              tone="weakness"
              onSelect={(k) => update(p.id, { weakness: k })}
            />
          </Card>
        );
      })}

      {participants.length === 0 && (
        <Card>
          <Text style={[type.bodyM, { color: colors.textSecondary }]}>
            Bu maçta puanlanacak oyuncu yok.
          </Text>
        </Card>
      )}

      {participants.length > 0 && (
        <Button title="Puanlamayı gönder" onPress={submit} loading={saving} />
      )}
    </ScrollView>
  );
}

function SkillPicker({
  selected,
  exclude,
  tone,
  onSelect,
}: {
  selected: SkillKey | null;
  exclude: SkillKey | null;
  tone: "strength" | "weakness";
  onSelect: (key: SkillKey) => void;
}) {
  const activeBg = tone === "strength" ? colors.pitch : colors.brick;
  return (
    <View style={s.chips}>
      {SKILLS.map((skill) => {
        const isSelected = selected === skill.key;
        const disabled = exclude === skill.key;
        return (
          <Pressable
            key={skill.key}
            disabled={disabled}
            onPress={() => onSelect(skill.key)}
            style={[
              s.chip,
              isSelected && { backgroundColor: activeBg, borderColor: activeBg },
              disabled && { opacity: 0.35 },
            ]}
          >
            <Text
              style={[
                type.bodySMedium,
                { color: isSelected ? colors.textOnBrand : colors.ink },
              ]}
            >
              {skill.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = {
  head: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: space[3],
    marginBottom: space[2],
  },
  eyebrow: {
    ...type.labelS,
    textTransform: "uppercase" as const,
    color: colors.ink300,
    marginBottom: space[2],
  },
  chips: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: space[2],
  },
  chip: {
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    borderRadius: radius.pill,
    borderWidth: border.width,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surfaceCard,
  },
};
