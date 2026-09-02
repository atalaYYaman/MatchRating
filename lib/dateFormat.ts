// Tarih/saat gosterimi. Mobildeki mobile/lib/format.ts ile ayni ciktiyi verir.

const MONTHS = [
  "OCA", "ŞUB", "MAR", "NİS", "MAY", "HAZ",
  "TEM", "AĞU", "EYL", "EKİ", "KAS", "ARA",
];

// JS getDay(): 0 = Pazar
const DAYS = ["PAZ", "PZT", "SAL", "ÇAR", "PER", "CUM", "CMT"];

export function dayNumber(iso: string): string {
  return String(new Date(iso).getDate()).padStart(2, "0");
}

/** "EYL · PER" */
export function monthAndDay(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} · ${DAYS[d.getDay()]}`;
}

/** "21:00" */
export function clockTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

/** "28 AĞU" */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** datetime-local input degeri icin "2026-09-04T21:00" */
export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function countdownLabel(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Başladı";

  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 1) return `${Math.max(1, Math.floor(diff / 60000))} dk kaldı`;
  if (hours < 24) return `${hours} saat kaldı`;
  return `${Math.floor(hours / 24)} gün kaldı`;
}
