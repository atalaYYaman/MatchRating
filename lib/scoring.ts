// 100'luk olcek, ama ortalamayi bozmamak icin sadece 60-90 arasi oy verilir.
export const MIN_SCORE = 60;
export const MAX_SCORE = 90;
export const DEFAULT_SCORE = 75; // hic oy almamis oyuncu icin notr orta puan

export function isValidScore(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_SCORE && value <= MAX_SCORE;
}
