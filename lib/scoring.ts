// 100'luk olcek, ama ortalamayi bozmamak icin sadece 60-90 arasi oy verilir.
export const MIN_SCORE = 60;
export const MAX_SCORE = 90;
export const DEFAULT_SCORE = 75; // hic oy almamis oyuncu icin notr orta puan
export const MIN_VOTES_FOR_RELIABLE = 3;

export function isValidScore(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_SCORE && value <= MAX_SCORE;
}

// n=0: notr varsayilan. n=1..4: medyan (kucuk orneklemde uc oyu etkisiz kilar).
// n>=5: kirpilmis ortalama (en dusuk ve en yuksek oy atilir).
export function aggregateScores(scores: number[]): { value: number; voteCount: number } {
  const n = scores.length;
  if (n === 0) return { value: DEFAULT_SCORE, voteCount: 0 };

  const sorted = [...scores].sort((a, b) => a - b);

  if (n >= 5) {
    const trimmed = sorted.slice(1, -1);
    const sum = trimmed.reduce((acc, v) => acc + v, 0);
    return { value: sum / trimmed.length, voteCount: n };
  }

  const mid = Math.floor(n / 2);
  const value = n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return { value, voteCount: n };
}
