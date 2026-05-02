import type { ParsedLogRow } from '../google/sheets.js';

/** A single data point on the progress chart. */
export interface ProgressDataPoint {
  date: string;
  value: number;
  /** Human-readable label for tooltips (e.g. "180 × 5" or "180 × 5 = 198"). */
  label?: string;
}

export type ProgressMetric = 'volume' | 'heaviest' | 'e1rm';

export type TimeRange = '1m' | '3m' | '12m' | 'all';

/** Set types that count toward progress metrics. Warmup sets are excluded. */
const QUALIFYING_SET_TYPES = new Set(['work', 'backoff', 'joker']);

/** Check whether a log row should contribute to progress metrics. */
function isQualifyingSet(row: ParsedLogRow): boolean {
  return (
    row.completed &&
    QUALIFYING_SET_TYPES.has(row.setType)
  );
}

/** Result from a metric computation: the aggregate value plus a tooltip label. */
interface MetricResult {
  value: number;
  label: string;
}

/**
 * Total volume: sum of (weight × reps) across all qualifying sets in a session.
 * Label shows the top set (heaviest weight × its reps).
 */
export function computeVolume(sets: ParsedLogRow[]): number {
  return computeVolumeWithLabel(sets).value;
}

function computeVolumeWithLabel(sets: ParsedLogRow[]): MetricResult {
  const qualifying = sets.filter(isQualifyingSet);
  const value = qualifying.reduce((sum, s) => sum + s.actualWeight * s.actualReps, 0);
  if (qualifying.length === 0) return { value: 0, label: '' };
  // Top set = heaviest weight; on tie pick the one with more reps
  const top = qualifying.reduce((best, s) =>
    s.actualWeight > best.actualWeight ||
    (s.actualWeight === best.actualWeight && s.actualReps > best.actualReps)
      ? s : best,
  );
  return { value, label: `${top.actualWeight} × ${top.actualReps}` };
}

/**
 * Heaviest weight: the maximum weight used in any qualifying set in a session.
 * Label shows weight × reps for that set.
 */
export function computeHeaviest(sets: ParsedLogRow[]): number {
  return computeHeaviestWithLabel(sets).value;
}

function computeHeaviestWithLabel(sets: ParsedLogRow[]): MetricResult {
  const qualifying = sets.filter(isQualifyingSet);
  if (qualifying.length === 0) return { value: 0, label: '' };
  const top = qualifying.reduce((best, s) =>
    s.actualWeight > best.actualWeight ||
    (s.actualWeight === best.actualWeight && s.actualReps > best.actualReps)
      ? s : best,
  );
  return { value: top.actualWeight, label: `${top.actualWeight} × ${top.actualReps}` };
}

/**
 * Estimated 1RM using the Epley formula: weight × (1 + reps / 30).
 * Takes the highest result across all qualifying sets in a session.
 * Label shows weight × reps = e1RM.
 */
export function computeE1RM(sets: ParsedLogRow[]): number {
  return computeE1RMWithLabel(sets).value;
}

function computeE1RMWithLabel(sets: ParsedLogRow[]): MetricResult {
  const qualifying = sets.filter(isQualifyingSet);
  if (qualifying.length === 0) return { value: 0, label: '' };
  let bestE1RM = 0;
  let bestSet = qualifying[0];
  for (const s of qualifying) {
    const e = s.actualWeight * (1 + s.actualReps / 30);
    if (e > bestE1RM) {
      bestE1RM = e;
      bestSet = s;
    }
  }
  const rounded = Math.round(bestE1RM);
  return {
    value: bestE1RM,
    label: `${bestSet.actualWeight} × ${bestSet.actualReps} = ${rounded}`,
  };
}

const METRIC_FN_WITH_LABEL: Record<ProgressMetric, (sets: ParsedLogRow[]) => MetricResult> = {
  volume: computeVolumeWithLabel,
  heaviest: computeHeaviestWithLabel,
  e1rm: computeE1RMWithLabel,
};

/**
 * Get all unique lift IDs from log rows that have qualifying set data.
 * Returns array of { liftId, exerciseName } sorted by exerciseName.
 */
export function getLiftsWithData(
  logRows: ParsedLogRow[],
): { liftId: string; exerciseName: string }[] {
  const seen = new Map<string, string>();
  for (const row of logRows) {
    if (isQualifyingSet(row) && row.liftId && !seen.has(row.liftId)) {
      seen.set(row.liftId, row.exerciseName);
    }
  }
  return [...seen.entries()]
    .map(([liftId, exerciseName]) => ({ liftId, exerciseName }))
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}

/**
 * Compute the cutoff date for a given time range.
 * Returns an ISO date string (YYYY-MM-DD) or null for 'all'.
 */
export function getCutoffDate(range: TimeRange): string | null {
  if (range === 'all') return null;
  const now = new Date();
  const months = range === '1m' ? 1 : range === '3m' ? 3 : 12;
  now.setMonth(now.getMonth() - months);
  return now.toISOString().slice(0, 10);
}

/**
 * Build progress data points for a given lift, metric, and time range.
 *
 * Groups log rows by (date + startTime) to identify individual sessions,
 * computes the selected metric for each session, and filters by time range.
 */
export function buildProgressData(
  logRows: ParsedLogRow[],
  liftId: string,
  metric: ProgressMetric,
  range: TimeRange,
): ProgressDataPoint[] {
  const cutoff = getCutoffDate(range);

  // Filter to the selected lift
  const liftRows = logRows.filter(
    (r) => r.liftId === liftId && (cutoff === null || r.date >= cutoff),
  );

  // Group by session (date + startTime)
  const sessions = new Map<string, ParsedLogRow[]>();
  for (const row of liftRows) {
    const key = `${row.date}|${row.startTime}`;
    const list = sessions.get(key);
    if (list) {
      list.push(row);
    } else {
      sessions.set(key, [row]);
    }
  }

  // Compute metric per session
  const fn = METRIC_FN_WITH_LABEL[metric];
  const points: ProgressDataPoint[] = [];
  for (const [key, sets] of sessions) {
    const { value, label } = fn(sets);
    if (value > 0) {
      const date = key.split('|')[0];
      points.push({ date, value, label });
    }
  }

  // Sort chronologically
  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

/**
 * Remove data points that are obviously from deload / taper / illness sessions.
 *
 * Uses a bi-directional running-peak algorithm:
 *
 * 1. **Forward pass** — walk left-to-right tracking the highest value seen so
 *    far.  Any point more than `threshold` (default 10 %) below that peak is
 *    marked as a dip.
 * 2. **Backward pass** — walk right-to-left doing the same, which preserves
 *    legitimate long-term declines (a gradual downtrend is reachable from both
 *    ends).
 * 3. A point is kept if **either** pass considers it valid.
 *
 * This handles multi-week dips (illness, travel, deload blocks) naturally
 * because every low point is compared against the running peak, not just its
 * immediate neighbors.
 */
export function filterDips(
  points: ProgressDataPoint[],
  threshold = 0.15,
): ProgressDataPoint[] {
  if (points.length < 3) return points;

  const n = points.length;
  const kept = new Set<number>();

  // Forward pass: keep points within threshold of the running peak
  kept.add(0);
  let peak = points[0].value;
  for (let i = 1; i < n; i++) {
    const v = points[i].value;
    if (v >= peak * (1 - threshold)) {
      kept.add(i);
      if (v > peak) peak = v;
    }
  }

  // Backward pass: same logic from the right
  kept.add(n - 1);
  peak = points[n - 1].value;
  for (let i = n - 2; i >= 0; i--) {
    const v = points[i].value;
    if (v >= peak * (1 - threshold)) {
      kept.add(i);
      if (v > peak) peak = v;
    }
  }

  return points.filter((_, i) => kept.has(i));
}
