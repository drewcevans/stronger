import { describe, expect, it } from 'vitest';
import {
  parseCsvRows,
  parseHevyCsv,
  convertHevyRows,
  computeImportSummary,
  slugify,
  kgToLbs,
  metersToMiles,
} from '../hevy-import.js';

/* ------------------------------------------------------------------ */
/*  slugify                                                            */
/* ------------------------------------------------------------------ */

describe('slugify', () => {
  it('converts a name to a slug', () => {
    expect(slugify('Push Day')).toBe('push-day');
  });

  it('strips parentheses and special characters', () => {
    expect(slugify('Bench Press (Barbell)')).toBe('bench-press-barbell');
  });

  it('collapses multiple separators', () => {
    expect(slugify('A  --  B')).toBe('a-b');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });
});

/* ------------------------------------------------------------------ */
/*  kgToLbs                                                            */
/* ------------------------------------------------------------------ */

describe('kgToLbs', () => {
  it('converts 100 kg to ~220.5 lbs', () => {
    expect(kgToLbs(100)).toBe(220.5);
  });

  it('rounds to nearest 0.5', () => {
    // 90 kg = 198.4158 lbs → rounds to 198.5
    expect(kgToLbs(90)).toBe(198.5);
  });

  it('handles zero', () => {
    expect(kgToLbs(0)).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  metersToMiles                                                      */
/* ------------------------------------------------------------------ */

describe('metersToMiles', () => {
  it('converts 1609.34 meters to ~1 mile', () => {
    expect(metersToMiles(1609.34)).toBeCloseTo(1, 5);
  });

  it('converts 5000 meters', () => {
    expect(metersToMiles(5000)).toBeCloseTo(3.107, 2);
  });
});

/* ------------------------------------------------------------------ */
/*  parseCsvRows                                                       */
/* ------------------------------------------------------------------ */

describe('parseCsvRows', () => {
  it('parses a simple CSV', () => {
    const csv = 'a,b,c\n1,2,3\n4,5,6\n';
    const rows = parseCsvRows(csv);
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
      ['4', '5', '6'],
    ]);
  });

  it('handles quoted fields with commas', () => {
    const csv = '"hello, world",b,c\n';
    const rows = parseCsvRows(csv);
    expect(rows[0][0]).toBe('hello, world');
  });

  it('handles escaped quotes inside quoted fields', () => {
    const csv = '"say ""hello""",b\n';
    const rows = parseCsvRows(csv);
    expect(rows[0][0]).toBe('say "hello"');
  });

  it('handles CRLF line endings', () => {
    const csv = 'a,b\r\nc,d\r\n';
    const rows = parseCsvRows(csv);
    expect(rows).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('handles empty fields', () => {
    const csv = 'a,,c\n';
    const rows = parseCsvRows(csv);
    expect(rows[0]).toEqual(['a', '', 'c']);
  });
});

/* ------------------------------------------------------------------ */
/*  parseHevyCsv                                                       */
/* ------------------------------------------------------------------ */

const HEVY_HEADER =
  'Workout Name,Workout Start,Workout End,Workout Notes,Exercise Name,Set Order,Weight (kg),Reps,Distance (meters),Seconds,Weight System,Set Type,Exercise Category,Exercise Comments,Rest Time,Workout Duration,Workout Date';

function makeHevyCsv(...dataRows: string[]): string {
  return [HEVY_HEADER, ...dataRows].join('\n') + '\n';
}

describe('parseHevyCsv', () => {
  it('parses a single row', () => {
    const csv = makeHevyCsv(
      'Push Day,2025-01-15 08:30:00,2025-01-15 09:45:00,,Bench Press (Barbell),1,90,6,,,metric,normal,Barbell,,,75 min,2025-01-15',
    );
    const rows = parseHevyCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].workoutName).toBe('Push Day');
    expect(rows[0].exerciseName).toBe('Bench Press (Barbell)');
    expect(rows[0].weightKg).toBe('90');
    expect(rows[0].reps).toBe('6');
    expect(rows[0].setOrder).toBe('1');
    expect(rows[0].weightSystem).toBe('metric');
    expect(rows[0].setType).toBe('normal');
    expect(rows[0].workoutDate).toBe('2025-01-15');
  });

  it('parses multiple rows', () => {
    const csv = makeHevyCsv(
      'Push Day,2025-01-15 08:30:00,2025-01-15 09:45:00,,Bench Press (Barbell),1,90,6,,,metric,normal,Barbell,,,75 min,2025-01-15',
      'Push Day,2025-01-15 08:30:00,2025-01-15 09:45:00,,Bench Press (Barbell),2,90,6,,,metric,normal,Barbell,,,75 min,2025-01-15',
    );
    const rows = parseHevyCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[1].setOrder).toBe('2');
  });

  it('throws on empty CSV', () => {
    expect(() => parseHevyCsv('')).toThrow('CSV file is empty');
  });

  it('throws when required column is missing', () => {
    const csv = 'foo,bar\n1,2\n';
    expect(() => parseHevyCsv(csv)).toThrow('Missing required column');
  });

  it('skips empty rows', () => {
    const csv = makeHevyCsv(
      'Push Day,2025-01-15 08:30:00,2025-01-15 09:45:00,,Bench Press (Barbell),1,90,6,,,metric,normal,Barbell,,,75 min,2025-01-15',
      '',
    );
    const rows = parseHevyCsv(csv);
    expect(rows).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/*  convertHevyRows                                                    */
/* ------------------------------------------------------------------ */

describe('convertHevyRows', () => {
  it('produces a 18-column row per input', () => {
    const csv = makeHevyCsv(
      'Push Day,2025-01-15 08:30:00,2025-01-15 09:45:00,,Bench Press (Barbell),1,90,6,,,metric,normal,Barbell,,,75 min,2025-01-15',
    );
    const hevy = parseHevyCsv(csv);
    const rows = convertHevyRows(hevy);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(18);
  });

  it('maps fields correctly for a strength set', () => {
    const csv = makeHevyCsv(
      'Push Day,2025-01-15 08:30:00,2025-01-15 09:45:00,,Bench Press (Barbell),1,90,6,,,metric,normal,Barbell,,,75 min,2025-01-15',
    );
    const rows = convertHevyRows(parseHevyCsv(csv));
    const r = rows[0];

    expect(r[0]).toBe('2025-01-15');                      // date
    expect(r[1]).toBe('2025-01-15T08:30:00');              // startTime
    expect(r[2]).toBe('2025-01-15T09:45:00');              // endTime
    expect(r[3]).toBe('push-day');                         // workoutId
    expect(r[4]).toBe('Bench Press (Barbell)');            // exerciseName
    expect(r[5]).toBe('bench-press-barbell');              // liftId
    expect(r[6]).toBe(1);                                  // setNumber
    expect(r[7]).toBe('work');                              // setType (normal → work)
    expect(r[8]).toBe(kgToLbs(90));                        // plannedWeight
    expect(r[9]).toBe(6);                                  // plannedReps
    expect(r[10]).toBe(kgToLbs(90));                       // actualWeight
    expect(r[11]).toBe(6);                                 // actualReps
    expect(r[12]).toBe('TRUE');                             // completed
    expect(r[13]).toBe('strength');                         // category
    expect(r[14]).toBe('');                                 // duration (empty for strength)
    expect(r[15]).toBe('');                                 // distance
    expect(r[16]).toBe('');                                 // elevation
    expect(r[17]).toBe('');                                 // cardioWeight
  });

  it('maps warmup set type', () => {
    const csv = makeHevyCsv(
      'Push Day,2025-01-15 08:30:00,2025-01-15 09:45:00,,Bench Press (Barbell),1,60,8,,,metric,warmup,Barbell,,,75 min,2025-01-15',
    );
    const rows = convertHevyRows(parseHevyCsv(csv));
    expect(rows[0][7]).toBe('warmup');
  });

  it('does not convert imperial weights', () => {
    const csv = makeHevyCsv(
      'Push Day,2025-01-15 08:30:00,2025-01-15 09:45:00,,Bench Press (Barbell),1,200,6,,,imperial,normal,Barbell,,,75 min,2025-01-15',
    );
    const rows = convertHevyRows(parseHevyCsv(csv));
    expect(rows[0][8]).toBe(200);  // no conversion
    expect(rows[0][10]).toBe(200);
  });

  it('categorizes cardio rows (distance + no weight)', () => {
    const csv = makeHevyCsv(
      'Running,2025-01-15 08:30:00,2025-01-15 09:00:00,,Treadmill,1,,0,5000,1800,metric,normal,Cardio,,,30 min,2025-01-15',
    );
    const rows = convertHevyRows(parseHevyCsv(csv));
    const r = rows[0];
    expect(r[13]).toBe('cardio');
    // duration: 1800s / 60 = 30 min
    expect(r[14]).toBe(30);
    // distance: 5000m → miles
    expect(r[15]).toBeCloseTo(3.107, 2);
  });

  it('handles zero weight + zero reps (bodyweight exercises)', () => {
    const csv = makeHevyCsv(
      'Push Day,2025-01-15 08:30:00,2025-01-15 09:45:00,,Push Up,1,0,10,,,metric,normal,Bodyweight,,,75 min,2025-01-15',
    );
    const rows = convertHevyRows(parseHevyCsv(csv));
    expect(rows[0][8]).toBe(0);   // weight
    expect(rows[0][9]).toBe(10);  // reps
    expect(rows[0][12]).toBe('TRUE');
    expect(rows[0][13]).toBe('strength');
  });

  it('defaults missing setOrder to 1', () => {
    const csv = makeHevyCsv(
      'Push Day,2025-01-15 08:30:00,2025-01-15 09:45:00,,Bench Press (Barbell),,90,6,,,metric,normal,Barbell,,,75 min,2025-01-15',
    );
    const rows = convertHevyRows(parseHevyCsv(csv));
    expect(rows[0][6]).toBe(1);
  });

  it('extracts date from workoutStart when workoutDate is missing', () => {
    const csv = makeHevyCsv(
      'Push Day,2025-01-15 08:30:00,2025-01-15 09:45:00,,Bench Press (Barbell),1,90,6,,,metric,normal,Barbell,,,,',
    );
    const rows = convertHevyRows(parseHevyCsv(csv));
    expect(rows[0][0]).toBe('2025-01-15');
  });
});

/* ------------------------------------------------------------------ */
/*  computeImportSummary                                                */
/* ------------------------------------------------------------------ */

describe('computeImportSummary', () => {
  it('computes summary from parsed rows', () => {
    const csv = makeHevyCsv(
      'Push Day,2025-01-15 08:30:00,2025-01-15 09:45:00,,Bench Press (Barbell),1,90,6,,,metric,normal,Barbell,,,75 min,2025-01-15',
      'Push Day,2025-01-15 08:30:00,2025-01-15 09:45:00,,Bench Press (Barbell),2,90,6,,,metric,normal,Barbell,,,75 min,2025-01-15',
      'Pull Day,2025-01-16 08:30:00,2025-01-16 09:45:00,,Barbell Row,1,60,8,,,metric,normal,Barbell,,,75 min,2025-01-16',
    );
    const hevy = parseHevyCsv(csv);
    const summary = computeImportSummary(hevy);

    expect(summary.totalSets).toBe(3);
    expect(summary.uniqueExercises).toBe(2);
    expect(summary.workoutCount).toBe(2);
    expect(summary.dateRange.start).toBe('2025-01-15');
    expect(summary.dateRange.end).toBe('2025-01-16');
  });

  it('counts unique workouts by date+name', () => {
    const csv = makeHevyCsv(
      'Push Day,2025-01-15 08:30:00,2025-01-15 09:45:00,,Bench Press,1,90,6,,,metric,normal,Barbell,,,75 min,2025-01-15',
      'Push Day,2025-01-20 08:30:00,2025-01-20 09:45:00,,Bench Press,1,95,6,,,metric,normal,Barbell,,,75 min,2025-01-20',
    );
    const summary = computeImportSummary(parseHevyCsv(csv));
    expect(summary.workoutCount).toBe(2);  // same name, different dates
  });

  it('handles a single row', () => {
    const csv = makeHevyCsv(
      'Push Day,2025-01-15 08:30:00,2025-01-15 09:45:00,,Bench Press,1,90,6,,,metric,normal,Barbell,,,75 min,2025-01-15',
    );
    const summary = computeImportSummary(parseHevyCsv(csv));
    expect(summary.dateRange.start).toBe('2025-01-15');
    expect(summary.dateRange.end).toBe('2025-01-15');
    expect(summary.totalSets).toBe(1);
    expect(summary.uniqueExercises).toBe(1);
    expect(summary.workoutCount).toBe(1);
  });
});
