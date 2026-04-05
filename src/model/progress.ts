import type { ParsedLogRow } from '../google/sheets.js';

/** A single data point on the progress chart. */
export interface ProgressDataPoint {
  date: string;
  value: number;
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

/**
 * Total volume: sum of (weight × reps) across all qualifying sets in a session.
 */
export function computeVolume(sets: ParsedLogRow[]): number {
  return sets
    .filter(isQualifyingSet)
    .reduce((sum, s) => sum + s.actualWeight * s.actualReps, 0);
}

/**
 * Heaviest weight: the maximum weight used in any qualifying set in a session.
 */
export function computeHeaviest(sets: ParsedLogRow[]): number {
  const qualifying = sets.filter(isQualifyingSet);
  if (qualifying.length === 0) return 0;
  return Math.max(...qualifying.map((s) => s.actualWeight));
}

/**
 * Estimated 1RM using the Epley formula: weight × (1 + reps / 30).
 * Takes the highest result across all qualifying sets in a session.
 */
export function computeE1RM(sets: ParsedLogRow[]): number {
  const qualifying = sets.filter(isQualifyingSet);
  if (qualifying.length === 0) return 0;
  return Math.max(
    ...qualifying.map((s) => s.actualWeight * (1 + s.actualReps / 30)),
  );
}

const METRIC_FN: Record<ProgressMetric, (sets: ParsedLogRow[]) => number> = {
  volume: computeVolume,
  heaviest: computeHeaviest,
  e1rm: computeE1RM,
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
  const fn = METRIC_FN[metric];
  const points: ProgressDataPoint[] = [];
  for (const [key, sets] of sessions) {
    const value = fn(sets);
    if (value > 0) {
      const date = key.split('|')[0];
      points.push({ date, value });
    }
  }

  // Sort chronologically
  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}
