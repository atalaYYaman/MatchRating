import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import {
  Badge,
  Button,
  Card,
  ErrorText,
  Field,
  Label,
} from "../../../../../../components/ui";
import { api, ApiError } from "../../../../../../lib/api";
import { clockTime, countdownLabel, shortDate } from "../../../../../../lib/format";
import { border, colors, radius, space, type } from "../../../../../../lib/theme";

type Detail = {
  match: {
    id: string;
    mode: "poll" | "fixed";
    match_kind: "ic" | "dis";
    required_players: number | null;
    note: string | null;
    scheduled_at: string | null;
    location: string | null;
    status: "poll_open" | "scheduled" | "completed" | "cancelled";
    home_score: number | null;
    away_score: number | null;
    home_label: string | null;
    away_label: string | null;
  };
  isOwner: boolean;
  options: {
    id: string;
    startsAt: string;
    location: string;
    voteCount: number;
    voterIds: string[];
  }[];
  myPollResponse: { available: boolean } | null;
  myOptionIds: string[];
  attendance: { user_id: string; status: "yes" | "no"; name: string }[];
  myAttendance: "yes" | "no" | null;
  rating: {
    open: boolean;
    played: boolean;
    participants: { id: string; name: string }[];
  };
};

export default function MatchDetailScreen() {
  const { id, matchId } = useLocalSearchParams<{ id: string; matchId: string }>();

  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.get<Detail>(`/api/groups/${id}/matches/${matchId}`);
      setData(res);
      setPicked(new Set(res.myOptionIds));
      if (res.match.home_score != null) setHomeScore(String(res.match.home_score));
      if (res.match.away_score != null) setAwayScore(String(res.match.away_score));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Maç yüklenemedi.");
    }
  }, [id, matchId]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(fn: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surfacePage, padding: space[4] }}>
        <ErrorText>{error}</ErrorText>
      </View>
    );
  }

  const m = data.match;
  const isPoll = m.status === "poll_open";
  const attendees = data.attendance.filter((a) => a.status === "yes");
  // Anketi kesinlestirme / skor girme yetkisi. Sunucu da ayrica dogruluyor;
  // bu yalnizca arayuz gorunurlugu.
  const canManage = data.isOwner;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      contentContainerStyle={{ padding: space[4], gap: space[3] }}
      keyboardShouldPersistTaps="handled"
    >
      <ErrorText>{error}</ErrorText>

      {/* Ozet */}
      <Card raised>
        <View style={s.head}>
          <Badge tone={isPoll ? "accent" : m.status === "completed" ? "neutral" : "brand"}>
            {isPoll
              ? "Anket açık"
              : m.status === "scheduled"
              ? "Planlandı"
              : m.status === "completed"
              ? "Tamamlandı"
              : "İptal"}
          </Badge>
          <Text style={[type.bodyS, { color: colors.textTertiary }]}>
            {m.match_kind === "ic" ? "Takım içi" : "Dış rakip"}
          </Text>
        </View>

        {m.scheduled_at ? (
          <>
            <Text style={[type.displayM, { color: colors.ink, marginTop: space[2] }]}>
              {shortDate(m.scheduled_at)} · {clockTime(m.scheduled_at)}
            </Text>
            {m.location ? (
              <Text style={[type.bodyM, { color: colors.textSecondary }]}>
                {m.location}
              </Text>
            ) : null}
            {new Date(m.scheduled_at).getTime() > Date.now() && (
              <Text style={[type.bodySMedium, { color: colors.textLink, marginTop: 4 }]}>
                {countdownLabel(m.scheduled_at)}
              </Text>
            )}
          </>
        ) : (
          <Text style={[type.displayS, { color: colors.ink, marginTop: space[2] }]}>
            Tarih anketi sürüyor
          </Text>
        )}

        {m.note ? (
          <Text style={[type.bodyS, { color: colors.textSecondary, marginTop: space[2] }]}>
            {m.note}
          </Text>
        ) : null}
      </Card>

      {/* Anket */}
      {isPoll && (
        <Card>
          <Label>Hangi seçeneklere katılabilirsin?</Label>
          {data.options.map((o) => {
            const on = picked.has(o.id);
            return (
              <Pressable
                key={o.id}
                onPress={() =>
                  setPicked((prev) => {
                    const next = new Set(prev);
                    if (next.has(o.id)) next.delete(o.id);
                    else next.add(o.id);
                    return next;
                  })
                }
                style={[s.option, on && s.optionOn]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[type.bodyMMedium, { color: colors.ink }]}>
                    {shortDate(o.startsAt)} · {clockTime(o.startsAt)}
                  </Text>
                  <Text style={[type.bodyS, { color: colors.textSecondary }]}>
                    {o.location} · {o.voteCount} oy
                  </Text>
                </View>
                <Feather
                  name={on ? "check-square" : "square"}
                  size={20}
                  color={on ? colors.pitch : colors.ink300}
                />
              </Pressable>
            );
          })}

          <View style={{ gap: space[2], marginTop: space[3] }}>
            <Button
              title="Seçimimi kaydet"
              loading={busy}
              onPress={() =>
                run(
                  () =>
                    api.post(`/api/groups/${id}/matches/${matchId}/poll`, {
                      available: true,
                      optionIds: [...picked],
                    }),
                  "Kaydedilemedi."
                )
              }
            />
            <Button
              title="Hiçbirine katılamam"
              variant="secondary"
              onPress={() =>
                run(
                  () =>
                    api.post(`/api/groups/${id}/matches/${matchId}/poll`, {
                      available: false,
                      optionIds: [],
                    }),
                  "Kaydedilemedi."
                )
              }
            />
          </View>

          {data.myPollResponse && (
            <Text style={[type.bodyS, { color: colors.textSecondary, marginTop: space[2] }]}>
              {data.myPollResponse.available
                ? "Cevabın kaydedildi."
                : "Katılamayacağını bildirdin."}
            </Text>
          )}
        </Card>
      )}

      {/* Yonetici: anketi kesinlestir */}
      {isPoll && canManage && (
        <Card>
          <Label>Anketi kapat ve maçı planla</Label>
          {data.options.map((o) => (
            <View key={o.id} style={s.finalizeRow}>
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyMMedium, { color: colors.ink }]}>
                  {shortDate(o.startsAt)} · {clockTime(o.startsAt)}
                </Text>
                <Text style={[type.bodyS, { color: colors.textSecondary }]}>
                  {o.location} · {o.voteCount} oy
                </Text>
              </View>
              <Button
                title="Seç"
                size="small"
                onPress={() =>
                  Alert.alert(
                    "Maçı planla",
                    `${shortDate(o.startsAt)} ${clockTime(o.startsAt)} · ${o.location} kesinleşsin mi?`,
                    [
                      { text: "Vazgeç", style: "cancel" },
                      {
                        text: "Kesinleştir",
                        onPress: () =>
                          run(
                            () =>
                              api.post(
                                `/api/groups/${id}/matches/${matchId}/finalize`,
                                { optionId: o.id }
                              ),
                            "Kesinleştirilemedi."
                          ),
                      },
                    ]
                  )
                }
              />
            </View>
          ))}
        </Card>
      )}

      {/* Yoklama */}
      {m.status === "scheduled" && (
        <Card>
          <View style={s.head}>
            <Label>Yoklama</Label>
            <Text style={[type.scoreS, { color: colors.ink }]}>
              {attendees.length}
              {m.required_players ? `/${m.required_players}` : ""}
            </Text>
          </View>

          {new Date(m.scheduled_at ?? 0).getTime() > Date.now() ? (
            <View style={{ flexDirection: "row", gap: space[2], marginBottom: space[3] }}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Katılıyorum"
                  variant={data.myAttendance === "yes" ? "primary" : "secondary"}
                  loading={busy}
                  onPress={() =>
                    run(
                      () =>
                        api.post(`/api/groups/${id}/matches/${matchId}/attendance`, {
                          status: "yes",
                        }),
                      "Kaydedilemedi."
                    )
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Katılmıyorum"
                  variant={data.myAttendance === "no" ? "danger" : "secondary"}
                  loading={busy}
                  onPress={() =>
                    run(
                      () =>
                        api.post(`/api/groups/${id}/matches/${matchId}/attendance`, {
                          status: "no",
                        }),
                      "Kaydedilemedi."
                    )
                  }
                />
              </View>
            </View>
          ) : null}

          {attendees.length === 0 ? (
            <Text style={[type.bodyS, { color: colors.textSecondary }]}>
              Henüz katılan yok.
            </Text>
          ) : (
            attendees.map((a) => (
              <View key={a.user_id} style={s.attendeeRow}>
                <Feather name="check" size={14} color={colors.pitch} />
                <Text style={[type.bodyM, { color: colors.ink }]}>{a.name}</Text>
              </View>
            ))
          )}
        </Card>
      )}

      {/* Puanlama */}
      {data.rating.open && (
        <Button
          title="Maçı oyla"
          onPress={() => router.push(`/group/${id}/match/${matchId}/rate`)}
        />
      )}

      {/* Skor (yonetici, mac oynandiktan sonra) */}
      {data.rating.played && canManage && (
        <Card>
          <Label>Skor</Label>
          <View style={{ flexDirection: "row", gap: space[2], alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Field
                value={homeScore}
                onChangeText={setHomeScore}
                keyboardType="number-pad"
                placeholder={m.match_kind === "ic" ? "Takım 1" : "Biz"}
              />
            </View>
            <Text style={[type.scoreM, { color: colors.ink300, marginBottom: space[3] }]}>
              –
            </Text>
            <View style={{ flex: 1 }}>
              <Field
                value={awayScore}
                onChangeText={setAwayScore}
                keyboardType="number-pad"
                placeholder={m.match_kind === "ic" ? "Takım 2" : "Rakip"}
              />
            </View>
          </View>
          <Button
            title="Skoru kaydet"
            variant="secondary"
            loading={busy}
            onPress={() =>
              run(
                () =>
                  api.patch(`/api/groups/${id}/matches/${matchId}/result`, {
                    homeScore: Number(homeScore),
                    awayScore: Number(awayScore),
                  }),
                "Skor kaydedilemedi."
              )
            }
          />
        </Card>
      )}
    </ScrollView>
  );
}

const s = {
  head: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  option: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: space[3],
    padding: space[3],
    marginBottom: space[2],
    borderRadius: radius.button,
    borderWidth: border.width,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surfaceCardRaised,
  },
  optionOn: {
    borderColor: colors.pitch,
    borderWidth: border.widthThick,
    backgroundColor: colors.pitch100,
  },
  finalizeRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: space[3],
    paddingVertical: space[2] + 2,
    borderBottomWidth: border.width,
    borderBottomColor: colors.borderDefault,
  },
  attendeeRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: space[2],
    paddingVertical: space[2],
  },
};
