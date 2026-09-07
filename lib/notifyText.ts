import { sql } from "@/lib/db";

// Bildirim metinleri.
//
// Bir bildirim, kullanici uygulamayi ACMADAN karar verebilmesini
// saglamali: hangi takim, ne zaman, nerede. Ilk surumde basliklar
// ("Yeni maç var") bunlarin hicbirini yanitlamiyordu ve iki takimda
// oynayan biri hangi takimdan bahsedildigini bilemiyordu.
//
// Metinler burada toplandi; daha once dort ayri dosyaya dagilmisti ve
// birbirinden habersiz bicimlerdeydi.

// Sunucu UTC calisiyor. Saat dilimini yazmazsak mac 21:00 yerine 18:00
// gorunur -- bildirimde en cok guvenilen bilgi tam da bu.
const TZ = "Europe/Istanbul";

const dayFmt = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
});
const weekdayFmt = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TZ,
  weekday: "short",
});
const timeFmt = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "6 Eyl Paz · 21:00" */
export function whenLabel(value: string | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${dayFmt.format(d)} ${weekdayFmt.format(d)} · ${timeFmt.format(d)}`;
}

/** "21:00" */
export function timeLabel(value: string | Date): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : timeFmt.format(d);
}

/**
 * Baslikta takim adi: iki takimda oynayan biri icin hangi takimdan
 * bahsedildigi tek bakista anlasilsin. Tek takimi olan icin de zarari
 * yok, bildirimi sahiplendiriyor.
 */
export function heading(event: string, group: string | null): string {
  return group ? `${event} · ${group}` : event;
}

/** Bildirim metninde kullanilacak takim adi. */
export async function groupName(groupId: string): Promise<string | null> {
  const res = await sql`SELECT name FROM groups WHERE id = ${groupId}`;
  return (res.rows[0]?.name as string | undefined) ?? null;
}

/** "Evliya Çelebi Halı Saha" gibi bir konumu metne ekler, bossa atlar. */
export function withPlace(when: string, place: string | null | undefined): string {
  const p = place?.trim();
  return p ? `${when} · ${p}` : when;
}
