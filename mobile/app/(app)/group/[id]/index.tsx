import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Button, Card, ErrorText, Field, Screen } from "../../../../components/ui";
import { api, ApiError } from "../../../../lib/api";
import { positionLabel } from "../../../../lib/constants";
import { colors, space, type } from "../../../../lib/theme";

type Group = { id: string; name: string; invite_code: string; owner_id: string };
type MatchRecord = { played: number; wins: number; draws: number; losses: number };
type Member = {
  id: string;
  name: string;
  account_name: string;
  email: string;
  nickname: string | null;
  record: MatchRecord;
};
type Rating = {
  userId: string;
  name: string;
  overall: number;
  voteCount: number;
  hasVotes: boolean;
  primaryPosition: string | null;
  secondaryPosition: string | null;
};

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNickname, setEditNickname] = useState("");
  const [savingMember, setSavingMember] = useState(false);

  const load = useCallback(async () => {
    try {
      const [groupData, ratingsData] = await Promise.all([
        api.get<{ group: Group; members: Member[]; isOwner: boolean; meId: string }>(
          `/api/groups/${id}`
        ),
        api.get<{ ratings: Rating[] }>(`/api/groups/${id}/ratings`),
      ]);
      setGroup(groupData.group);
      setMembers(groupData.members);
      setIsOwner(groupData.isOwner);
      setMeId(groupData.meId ?? null);
      setRatings(ratingsData.ratings);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Takım yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function saveNickname(userId: string) {
    setSavingMember(true);
    setActionError(null);
    try {
      await api.patch(`/api/groups/${id}/members/${userId}`, { nickname: editNickname });
      setEditingId(null);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Takma ad kaydedilemedi.");
    } finally {
      setSavingMember(false);
    }
  }

  function confirmDeleteGroup() {
    Alert.alert(
      "Takımı sil",
      `"${group?.name}" kalıcı olarak silinecek. Tüm maçlar, oylar ve puanlar da gidecek.`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            setSavingMember(true);
            try {
              await api.delete(`/api/groups/${id}`);
              router.replace("/groups");
            } catch (err) {
              setActionError(
                err instanceof ApiError ? err.message : "Takım silinemedi."
              );
            } finally {
              setSavingMember(false);
            }
          },
        },
      ]
    );
  }

  function confirmLeaveGroup() {
    Alert.alert(
      "Takımdan ayrıl",
      "Bu takımdan ayrılacaksın. Oyların da silinecek.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Ayrıl",
          style: "destructive",
          onPress: async () => {
            setSavingMember(true);
            try {
              await api.delete(`/api/groups/${id}/members/${meId}`);
              router.replace("/groups");
            } catch (err) {
              setActionError(
                err instanceof ApiError ? err.message : "Takımdan ayrılınamadı."
              );
            } finally {
              setSavingMember(false);
            }
          },
        },
      ]
    );
  }

  function confirmRemoveMember(member: Member) {
    Alert.alert(
      "Üyeyi çıkar",
      `${member.name} gruptan çıkarılsın mı? Oyları da silinir.`,
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Çıkar", style: "destructive", onPress: () => removeMember(member) },
      ]
    );
  }

  async function removeMember(member: Member) {
    setSavingMember(true);
    setActionError(null);
    try {
      await api.delete(`/api/groups/${id}/members/${member.id}`);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Üye çıkarılamadı.");
    } finally {
      setSavingMember(false);
    }
  }

  const ratingByUser = new Map(ratings.map((r) => [r.userId, r]));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Screen>
        <ErrorText>{error}</ErrorText>

        {group && (
          <Card>
            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.textPrimary }}>
              {group.name}
            </Text>
            <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
              Davet kodu: {group.invite_code}
              {isOwner ? " · Yöneticisin" : ""}
            </Text>
          </Card>
        )}

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Button title="Oylama Yap" onPress={() => router.push(`/group/${id}/vote`)} />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Button
              title="Takımları Oluştur"
              variant="secondary"
              onPress={() => router.push(`/group/${id}/teams`)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Puan Detayı"
              variant="secondary"
              onPress={() => router.push(`/group/${id}/breakdown`)}
            />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Button
              title="Sezonlar"
              variant="secondary"
              onPress={() => router.push(`/group/${id}/seasons`)}
            />
          </View>
        </View>

        <Text style={{ fontWeight: "700", marginBottom: 8, color: colors.textPrimary }}>
          Üyeler ({members.length})
        </Text>
        <ErrorText>{actionError}</ErrorText>
        {loading && (
          <View style={{ paddingVertical: 20 }}>
            <ActivityIndicator color={colors.pitch} />
          </View>
        )}
        {members.map((m) => {
          const r = ratingByUser.get(m.id);
          const isGroupOwner = group ? m.id === group.owner_id : false;
          const editing = editingId === m.id;
          return (
            <Card key={m.id}>
              {editing ? (
                <View>
                  <Field
                    value={editNickname}
                    onChangeText={setEditNickname}
                    placeholder={m.account_name || m.name}
                    maxLength={40}
                    editable={!savingMember}
                  />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Kaydet"
                        onPress={() => saveNickname(m.id)}
                        loading={savingMember}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="İptal"
                        variant="secondary"
                        onPress={() => setEditingId(null)}
                        disabled={savingMember}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <View>
                  <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                    <Text style={{ fontWeight: "600", color: colors.textPrimary }}>{m.name}</Text>
                    {isGroupOwner && (
                      <Text
                        style={{
                          marginLeft: 6,
                          fontSize: 11,
                          color: colors.pitch,
                          fontWeight: "700",
                        }}
                      >
                        YÖNETİCİ
                      </Text>
                    )}
                  </View>
                  {m.nickname && m.account_name && m.nickname !== m.account_name && (
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                      ({m.account_name})
                    </Text>
                  )}
                  <Text style={{ color: colors.textSecondary, marginTop: 2 }}>
                    {r?.hasVotes
                      ? `Güç: ${r.overall} · ${positionLabel(r.primaryPosition)} / ${positionLabel(
                          r.secondaryPosition
                        )} · ${r.voteCount} oy`
                      : "Henüz oy almadı"}
                  </Text>
                  {m.record.played > 0 && (
                    <Text style={{ color: colors.textTertiary, marginTop: 2, fontSize: 13 }}>
                      {m.record.wins}G {m.record.draws}B {m.record.losses}M
                    </Text>
                  )}

                  {isOwner && (
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Button
                          title="Takma ad"
                          variant="secondary"
                          onPress={() => {
                            setEditingId(m.id);
                            setEditNickname(m.nickname || m.name);
                            setActionError(null);
                          }}
                          disabled={savingMember}
                        />
                      </View>
                      {!isGroupOwner && (
                        <View style={{ flex: 1 }}>
                          <Button
                            title="Çıkar"
                            variant="danger"
                            onPress={() => confirmRemoveMember(m)}
                            disabled={savingMember}
                          />
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}
            </Card>
          );
        })}

        {/* Geri alinamaz islemler en altta, ayri bir blokta */}
        <Card style={{ marginTop: space[6] }}>
          <Text style={[type.labelS, { textTransform: "uppercase", color: colors.textTertiary }]}>
            TAKIM AYARLARI
          </Text>
          <Text
            style={[type.bodyS, { color: colors.textSecondary, marginVertical: space[2] }]}
          >
            {isOwner
              ? "Takımı silmek geri alınamaz; tüm maçlar, oylar ve puanlar da silinir."
              : "Takımdan ayrılırsan bu takımdaki oyların silinir. Davet koduyla tekrar katılabilirsin."}
          </Text>
          <Button
            title={isOwner ? "Takımı sil" : "Takımdan ayrıl"}
            variant="danger"
            loading={savingMember}
            onPress={isOwner ? confirmDeleteGroup : confirmLeaveGroup}
          />
        </Card>
      </Screen>
    </ScrollView>
  );
}
