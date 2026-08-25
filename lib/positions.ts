export const POSITIONS = [
  { key: "kaleci", label: "Kaleci" },
  { key: "stoper", label: "Stoper" },
  { key: "bek", label: "Bek" },
  { key: "orta_saha", label: "Orta saha" },
  { key: "kanat", label: "Kanat" },
  { key: "forvet", label: "Forvet" },
] as const;

export type PositionKey = (typeof POSITIONS)[number]["key"];

export const POSITION_KEYS: PositionKey[] = POSITIONS.map((p) => p.key);

const POSITION_SET = new Set<string>(POSITION_KEYS);

export function isPositionKey(value: unknown): value is PositionKey {
  return typeof value === "string" && POSITION_SET.has(value);
}

export function positionLabel(key: string | null | undefined): string {
  if (!isPositionKey(key)) return "—";
  return POSITIONS.find((p) => p.key === key)?.label ?? key;
}

export function formatPositions(
  primary: string | null | undefined,
  secondary: string | null | undefined
): string {
  if (!isPositionKey(primary)) return "—";
  if (!isPositionKey(secondary)) return positionLabel(primary);
  return `${positionLabel(primary)} / ${positionLabel(secondary)}`;
}

export type PositionVote = {
  primary: PositionKey;
  secondary: PositionKey;
};

export type AggregatedPositions = {
  primary: PositionKey | null;
  secondary: PositionKey | null;
};

// Birincil oy 2, ikincil oy 1 puan. En yuksek puan 1. mevki, sonrakisi 2. mevki.
export function aggregatePositions(votes: PositionVote[]): AggregatedPositions {
  const weight: Record<PositionKey, number> = {
    kaleci: 0,
    stoper: 0,
    bek: 0,
    orta_saha: 0,
    kanat: 0,
    forvet: 0,
  };
  const primaryCount: Record<PositionKey, number> = { ...weight };

  for (const vote of votes) {
    weight[vote.primary] += 2;
    primaryCount[vote.primary] += 1;
    weight[vote.secondary] += 1;
  }

  const ranked = POSITION_KEYS.filter((key) => weight[key] > 0).sort((a, b) => {
    if (weight[b] !== weight[a]) return weight[b] - weight[a];
    return primaryCount[b] - primaryCount[a];
  });

  return {
    primary: ranked[0] ?? null,
    secondary: ranked[1] ?? null,
  };
}

export function positionsByTarget(
  rows: { target_id: string; primary_position: string; secondary_position: string }[]
): Map<string, AggregatedPositions> {
  const grouped = new Map<string, PositionVote[]>();
  for (const row of rows) {
    if (!isPositionKey(row.primary_position) || !isPositionKey(row.secondary_position)) continue;
    const list = grouped.get(row.target_id) || [];
    list.push({ primary: row.primary_position, secondary: row.secondary_position });
    grouped.set(row.target_id, list);
  }

  const result = new Map<string, AggregatedPositions>();
  for (const [targetId, votes] of grouped) {
    result.set(targetId, aggregatePositions(votes));
  }
  return result;
}
