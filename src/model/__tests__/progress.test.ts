import { describe, it, expect } from 'vitest';
import {
  computeVolume,
  computeHeaviest,
  computeE1RM,
  getLiftsWithData,
  buildProgressData,
  getCutoffDate,
  filterDips,
} from '../progress.js';
import type { ParsedLogRow } from '../../google/sheets.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeRow(overrides: Partial<ParsedLogRow> = {}): ParsedLogRow {
  return {
    date: '2025-01-15',
    startTime: '08:00',
    endTime: '09:00',
    workoutId: 'w1',
    exerciseName: 'Squat',
    liftId: 'squat',
    setNumber: 1,
    setType: 'work',
    plannedWeight: 100,
    plannedReps: 5,
    actualWeight: 100,
    actualReps: 5,
    completed: true,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  computeVolume                                                      */
/* ------------------------------------------------------------------ */

describe('computeVolume', () => {
  it('sums weight × reps for qualifying sets', () => {
    const sets = [
      makeRow({ actualWeight: 100, actualReps: 5 }),
      makeRow({ actualWeight: 80, actualReps: 8, setType: 'backoff' }),
    ];
    expect(computeVolume(sets)).toBe(100 * 5 + 80 * 8);
  });

  it('excludes warmup sets', () => {
    const sets = [
      makeRow({ actualWeight: 60, actualReps: 10, setType: 'warmup' }),
      makeRow({ actualWeight: 100, actualReps: 5, setType: 'work' }),
    ];
    expect(computeVolume(sets)).toBe(500);
  });

  it('excludes incomplete sets', () => {
    const sets = [
      makeRow({ actualWeight: 100, actualReps: 5, completed: false }),
      makeRow({ actualWeight: 80, actualReps: 8 }),
    ];
    expect(computeVolume(sets)).toBe(640);
  });

  it('returns 0 for empty input', () => {
    expect(computeVolume([])).toBe(0);
  });

  it('includes joker sets', () => {
    const sets = [
      makeRow({ actualWeight: 120, actualReps: 3, setType: 'joker' }),
    ];
    expect(computeVolume(sets)).toBe(360);
  });
});

/* ------------------------------------------------------------------ */
/*  computeHeaviest                                                    */
/* ------------------------------------------------------------------ */

describe('computeHeaviest', () => {
  it('returns the max weight from qualifying sets', () => {
    const sets = [
      makeRow({ actualWeight: 100 }),
      makeRow({ actualWeight: 120, setType: 'joker' }),
      makeRow({ actualWeight: 80, setType: 'backoff' }),
    ];
    expect(computeHeaviest(sets)).toBe(120);
  });

  it('excludes warmup sets', () => {
    const sets = [
      makeRow({ actualWeight: 200, setType: 'warmup' }),
      makeRow({ actualWeight: 100, setType: 'work' }),
    ];
    expect(computeHeaviest(sets)).toBe(100);
  });

  it('returns 0 for empty input', () => {
    expect(computeHeaviest([])).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  computeE1RM                                                        */
/* ------------------------------------------------------------------ */

describe('computeE1RM', () => {
  it('applies Epley formula: weight × (1 + reps / 30)', () => {
    const sets = [makeRow({ actualWeight: 100, actualReps: 10 })];
    // 100 * (1 + 10/30) = 100 * 1.333... = 133.333...
    expect(computeE1RM(sets)).toBeCloseTo(133.33, 1);
  });

  it('for reps=1, e1RM equals the weight itself', () => {
    const sets = [makeRow({ actualWeight: 150, actualReps: 1 })];
    // 150 * (1 + 1/30) = 150 * 1.0333 = 155
    expect(computeE1RM(sets)).toBeCloseTo(155, 0);
  });

  it('takes the highest e1RM across sets', () => {
    const sets = [
      makeRow({ actualWeight: 100, actualReps: 5 }),  // 100 * 1.1667 = 116.67
      makeRow({ actualWeight: 90, actualReps: 10 }),   // 90 * 1.333 = 120.00
    ];
    expect(computeE1RM(sets)).toBeCloseTo(120, 0);
  });

  it('excludes warmup sets', () => {
    const sets = [
      makeRow({ actualWeight: 200, actualReps: 5, setType: 'warmup' }), // would be 233.33
      makeRow({ actualWeight: 100, actualReps: 5 }),                     // 116.67
    ];
    expect(computeE1RM(sets)).toBeCloseTo(116.67, 1);
  });

  it('returns 0 for empty input', () => {
    expect(computeE1RM([])).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  getLiftsWithData                                                   */
/* ------------------------------------------------------------------ */

describe('getLiftsWithData', () => {
  it('returns unique lifts with qualifying data sorted by name', () => {
    const rows = [
      makeRow({ liftId: 'bench', exerciseName: 'Bench Press' }),
      makeRow({ liftId: 'squat', exerciseName: 'Squat' }),
      makeRow({ liftId: 'bench', exerciseName: 'Bench Press' }), // duplicate
    ];
    expect(getLiftsWithData(rows)).toEqual([
      { liftId: 'bench', exerciseName: 'Bench Press' },
      { liftId: 'squat', exerciseName: 'Squat' },
    ]);
  });

  it('excludes warmup-only lifts', () => {
    const rows = [
      makeRow({ liftId: 'bench', exerciseName: 'Bench', setType: 'warmup' }),
    ];
    expect(getLiftsWithData(rows)).toEqual([]);
  });

  it('returns empty for empty input', () => {
    expect(getLiftsWithData([])).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/*  getCutoffDate                                                      */
/* ------------------------------------------------------------------ */

describe('getCutoffDate', () => {
  it('returns null for "all"', () => {
    expect(getCutoffDate('all')).toBeNull();
  });

  it('returns a date string for month-based ranges', () => {
    const result = getCutoffDate('1m');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

/* ------------------------------------------------------------------ */
/*  buildProgressData                                                  */
/* ------------------------------------------------------------------ */

describe('buildProgressData', () => {
  it('groups sets by session and computes metric per session', () => {
    const rows = [
      makeRow({ date: '2025-01-10', startTime: '08:00', liftId: 'squat', actualWeight: 100, actualReps: 5 }),
      makeRow({ date: '2025-01-10', startTime: '08:00', liftId: 'squat', actualWeight: 100, actualReps: 5, setNumber: 2 }),
      makeRow({ date: '2025-01-17', startTime: '09:00', liftId: 'squat', actualWeight: 110, actualReps: 5 }),
    ];
    const data = buildProgressData(rows, 'squat', 'volume', 'all');
    expect(data).toHaveLength(2);
    expect(data[0]).toEqual({ date: '2025-01-10', value: 1000 });
    expect(data[1]).toEqual({ date: '2025-01-17', value: 550 });
  });

  it('filters by lift ID', () => {
    const rows = [
      makeRow({ liftId: 'squat', actualWeight: 100, actualReps: 5 }),
      makeRow({ liftId: 'bench', actualWeight: 80, actualReps: 5 }),
    ];
    const data = buildProgressData(rows, 'squat', 'volume', 'all');
    expect(data).toHaveLength(1);
    expect(data[0].value).toBe(500);
  });

  it('applies time-range filter', () => {
    const rows = [
      makeRow({ date: '2020-01-01', liftId: 'squat', actualWeight: 100, actualReps: 5 }),
      makeRow({ date: '2025-12-01', liftId: 'squat', actualWeight: 120, actualReps: 5 }),
    ];
    const data = buildProgressData(rows, 'squat', 'volume', '1m');
    // Only recent data should appear (the 2020 row is too old)
    expect(data.length).toBeLessThanOrEqual(1);
  });

  it('sorts results chronologically', () => {
    const rows = [
      makeRow({ date: '2025-01-20', startTime: '08:00', liftId: 'squat', actualWeight: 100, actualReps: 5 }),
      makeRow({ date: '2025-01-10', startTime: '09:00', liftId: 'squat', actualWeight: 80, actualReps: 5 }),
    ];
    const data = buildProgressData(rows, 'squat', 'heaviest', 'all');
    expect(data[0].date).toBe('2025-01-10');
    expect(data[1].date).toBe('2025-01-20');
  });

  it('skips sessions where metric is 0 (no qualifying sets)', () => {
    const rows = [
      makeRow({ liftId: 'squat', setType: 'warmup', actualWeight: 60, actualReps: 10 }),
    ];
    const data = buildProgressData(rows, 'squat', 'volume', 'all');
    expect(data).toHaveLength(0);
  });

  it('returns empty for unknown lift', () => {
    const rows = [makeRow({ liftId: 'squat' })];
    const data = buildProgressData(rows, 'unknown', 'volume', 'all');
    expect(data).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  filterDips                                                         */
/* ------------------------------------------------------------------ */

describe('filterDips', () => {
  const pts = (values: number[]) =>
    values.map((v, i) => ({ date: `2025-01-${String(i + 1).padStart(2, '0')}`, value: v }));

  it('returns input unchanged when fewer than 3 points', () => {
    const two = pts([100, 200]);
    expect(filterDips(two)).toEqual(two);
    expect(filterDips([])).toEqual([]);
    expect(filterDips(pts([100]))).toEqual(pts([100]));
  });

  it('removes a single obvious dip (deload session)', () => {
    // 200 → 100 → 200 : the 100 is a 50% drop, clearly a dip
    const data = pts([200, 100, 200]);
    const result = filterDips(data);
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(200);
    expect(result[1].value).toBe(200);
  });

  it('removes consecutive deload sessions via iteration', () => {
    // 200 → 120 → 120 → 200 : both 120s are deload dips
    const data = pts([200, 120, 120, 200]);
    const result = filterDips(data);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.value)).toEqual([200, 200]);
  });

  it('preserves steady decline (not a dip pattern)', () => {
    const data = pts([200, 190, 180, 170, 160]);
    const result = filterDips(data);
    expect(result).toEqual(data);
  });

  it('preserves steady increase', () => {
    const data = pts([100, 110, 120, 130, 140]);
    const result = filterDips(data);
    expect(result).toEqual(data);
  });

  it('keeps first and last points always', () => {
    const data = pts([50, 200, 50]);
    const result = filterDips(data);
    // 50 is the first and last, 200 is not a dip (it's higher)
    expect(result).toEqual(data);
  });

  it('does not remove small fluctuations below threshold', () => {
    // 200 → 185 → 200 : 185/200 = 0.925, drop is 7.5%, below 10% threshold
    const data = pts([200, 185, 200]);
    const result = filterDips(data);
    expect(result).toEqual(data);
  });

  it('removes points just beyond threshold', () => {
    // 200 → 175 → 200 : 175/200 = 0.875, interpolated avg = 200,
    // 200 * 0.90 = 180, 175 < 180 → dip
    const data = pts([200, 175, 200]);
    const result = filterDips(data);
    expect(result).toHaveLength(2);
  });

  it('handles a V-shaped deload in the middle of progression', () => {
    const data = pts([100, 110, 120, 70, 125, 130]);
    const result = filterDips(data);
    // The 70 is clearly a deload dip
    expect(result.map((p) => p.value)).not.toContain(70);
    // Everything else should stay
    expect(result.map((p) => p.value)).toContain(120);
    expect(result.map((p) => p.value)).toContain(125);
  });

  it('accepts custom threshold', () => {
    // With lenient 0.15, 175 out of avg 200 (12.5% drop) is kept
    const data = pts([200, 175, 200]);
    expect(filterDips(data, 0.15)).toEqual(data);
    // With default 0.10, 175 is removed (12.5% > 10%)
    expect(filterDips(data, 0.10)).toHaveLength(2);
    // With stricter 0.05 threshold, 175 is also removed (12.5% > 5%)
    expect(filterDips(data, 0.05)).toHaveLength(2);
  });

  it('removes gradual multi-week dips (illness / travel)', () => {
    // A lifter progressing 200→210, then 3 weeks of reduced weight, then recovery
    const data = pts([200, 210, 190, 170, 160, 180, 210]);
    const result = filterDips(data);
    // 190 is ~9.5% below peak of 210, within 10% threshold → kept
    expect(result.map((p) => p.value)).toContain(190);
    // 170 (19%), 160 (24%), 180 (14%) are all >10% below peak → removed
    expect(result.map((p) => p.value)).not.toContain(170);
    expect(result.map((p) => p.value)).not.toContain(160);
    expect(result.map((p) => p.value)).not.toContain(180);
    // Endpoints and peak retained
    expect(result.map((p) => p.value)).toContain(200);
    expect(result.map((p) => p.value)).toContain(210);
  });

  it('removes a long deload block', () => {
    // 4 consecutive deload sessions well below peak
    const data = pts([200, 210, 150, 140, 130, 140, 205, 215]);
    const result = filterDips(data);
    expect(result.map((p) => p.value)).not.toContain(150);
    expect(result.map((p) => p.value)).not.toContain(140);
    expect(result.map((p) => p.value)).not.toContain(130);
    expect(result.map((p) => p.value)).toContain(200);
    expect(result.map((p) => p.value)).toContain(210);
    expect(result.map((p) => p.value)).toContain(205);
    expect(result.map((p) => p.value)).toContain(215);
  });
});
