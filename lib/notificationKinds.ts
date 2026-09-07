// Bildirim turlerinin TEK kaynagi.
//
// Buraya bir tur eklemek yeterli: ayar ekrani (web ve mobil) bu listeden
// uretiliyor, kanal eslemesi de burada. Daha once turler bir yerde tip,
// baska yerde kanal, ucuncu yerde ekran metni olarak duruyordu ve yeni
// tur eklerken biri unutuluyordu.
//
// VARSAYILAN ACIK: notification_prefs tablosunda satiri olmayan herkes
// bildirimi alir. Yeni tur ekledigimizde kimseye geriye donuk kayit
// yazmamiz gerekmiyor, herkes otomatik olarak aliyor.

export const NOTIFICATION_KINDS = [
  {
    kind: "mac_olusturuldu",
    label: "Yeni maç ve anket",
    description: "Takımında maç açıldığında ya da tarih anketi başladığında",
    channel: "maclar",
  },
  {
    kind: "mac_planlandi",
    label: "Maç tarihi belli oldu",
    description: "Anket kapanıp tarih kesinleştiğinde",
    channel: "maclar",
  },
  {
    kind: "yoklama_hatirlatma",
    label: "Yoklama hatırlatması",
    description: "Maç yaklaştığı hâlde geleceğini bildirmediysen",
    channel: "maclar",
  },
  {
    kind: "mac_yaklasiyor",
    label: "Maç yaklaşıyor",
    description: "Geleceğini söylediğin maçtan birkaç saat önce",
    channel: "maclar",
  },
  {
    kind: "kadro_hazir",
    label: "Kadrolar açıklandı",
    description: "Takımlar kurulup kilitlendiğinde",
    channel: "maclar",
  },
  {
    kind: "mac_iptal",
    label: "Maç iptal edildi",
    description: "Planlanmış bir maç iptal edildiğinde",
    channel: "maclar",
  },
  {
    kind: "puanlama_acildi",
    label: "Puanlama açıldı",
    description: "Maç bitip arkadaşlarını puanlama sırası geldiğinde",
    channel: "puanlama",
  },
  {
    kind: "puanlar_islendi",
    label: "Puanların güncellendi",
    description: "Maç puanlaması işlenip yeteneklerin değiştiğinde",
    channel: "puanlama",
  },
  {
    kind: "uye_katildi",
    label: "Takıma yeni oyuncu",
    description: "Davet koduyla biri takımına katıldığında",
    channel: "maclar",
  },
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]["kind"];

export const KIND_LIST: NotificationKind[] = NOTIFICATION_KINDS.map((k) => k.kind);

export const CHANNEL_BY_KIND = Object.fromEntries(
  NOTIFICATION_KINDS.map((k) => [k.kind, k.channel])
) as Record<NotificationKind, string>;

export function isNotificationKind(value: unknown): value is NotificationKind {
  return typeof value === "string" && (KIND_LIST as string[]).includes(value);
}
