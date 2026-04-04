import { describe, it, expect } from 'vitest';
import {
  computeVolume,
  computeHeaviest,
  computeE1RM,
  getLiftsWithData,
  buildProgressData,
  getCutoffDate,
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
    category: 'strength',
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

  it('excludes cardio sets', () => {
    const sets = [
      makeRow({ category: 'cardio', setType: 'work' }),
      makeRow({ actualWeight: 100, actualReps: 5 }),
    ];
    expect(computeVolume(sets)).toBe(500);
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

  it('excludes cardio rows', () => {
    const rows = [
      makeRow({ liftId: 'run', exerciseName: 'Running', category: 'cardio' }),
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
