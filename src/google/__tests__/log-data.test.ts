import { describe, it, expect } from 'vitest';
import { parseLogRow, findPreviousWorkoutSets } from '../sheets.ts';
import type { ParsedLogRow } from '../sheets.ts';

/* ------------------------------------------------------------------ */
/*  parseLogRow                                                        */
/* ------------------------------------------------------------------ */

describe('parseLogRow', () => {
	const validRow = [
		'2026-03-28',
		'2026-03-28T18:00:00.000Z',
		'2026-03-28T19:15:00.000Z',
		'A',
		'Primary: Bench Press',
		'bench',
		'1',
		'work',
		'200',
		'5',
		'200',
		'6',
		'TRUE',
	];

	it('parses a valid row into a ParsedLogRow', () => {
		const result = parseLogRow(validRow);
		expect(result).toEqual({
			date: '2026-03-28',
			startTime: '2026-03-28T18:00:00.000Z',
			endTime: '2026-03-28T19:15:00.000Z',
			workoutId: 'A',
			exerciseName: 'Primary: Bench Press',
			liftId: 'bench',
			setNumber: 1,
			setType: 'work',
			plannedWeight: 200,
			plannedReps: 5,
			actualWeight: 200,
			actualReps: 6,
			completed: true,
			category: 'strength',
		});
	});

	it('returns null for rows with fewer than 13 columns', () => {
		expect(parseLogRow(['2026-03-28', 'A'])).toBeNull();
		expect(parseLogRow([])).toBeNull();
	});

	it('returns null when date is empty', () => {
		const row = [...validRow];
		row[0] = '';
		expect(parseLogRow(row)).toBeNull();
	});

	it('returns null when startTime is empty', () => {
		const row = [...validRow];
		row[1] = '';
		expect(parseLogRow(row)).toBeNull();
	});

	it('returns null when workoutId is empty', () => {
		const row = [...validRow];
		row[3] = '';
		expect(parseLogRow(row)).toBeNull();
	});

	it('returns null when exerciseName is empty', () => {
		const row = [...validRow];
		row[4] = '';
		expect(parseLogRow(row)).toBeNull();
	});

	it('returns null when setNumber is not a positive integer', () => {
		expect(parseLogRow([...validRow.slice(0, 6), '0', ...validRow.slice(7)])).toBeNull();
		expect(parseLogRow([...validRow.slice(0, 6), '-1', ...validRow.slice(7)])).toBeNull();
		expect(parseLogRow([...validRow.slice(0, 6), 'abc', ...validRow.slice(7)])).toBeNull();
	});

	it('returns null when actualWeight is non-numeric', () => {
		const row = [...validRow];
		row[10] = 'abc';
		expect(parseLogRow(row)).toBeNull();
	});

	it('returns null when actualReps is non-numeric', () => {
		const row = [...validRow];
		row[11] = 'abc';
		expect(parseLogRow(row)).toBeNull();
	});

	it('parses FALSE for incomplete sets', () => {
		const row = [...validRow];
		row[12] = 'FALSE';
		expect(parseLogRow(row)!.completed).toBe(false);
	});

	it('defaults plannedWeight to 0 for non-numeric values', () => {
		const row = [...validRow];
		row[8] = 'N/A';
		expect(parseLogRow(row)!.plannedWeight).toBe(0);
	});

	it('trims whitespace from all fields', () => {
		const row = validRow.map((v) => `  ${v}  `);
		const result = parseLogRow(row);
		expect(result).not.toBeNull();
		expect(result!.workoutId).toBe('A');
		expect(result!.exerciseName).toBe('Primary: Bench Press');
	});
});

/* ------------------------------------------------------------------ */
/*  findPreviousWorkoutSets                                            */
/* ------------------------------------------------------------------ */

describe('findPreviousWorkoutSets', () => {
	function makeRow(overrides: Partial<ParsedLogRow> = {}): ParsedLogRow {
		return {
			date: '2026-03-28',
			startTime: '2026-03-28T18:00:00.000Z',
			endTime: '2026-03-28T19:15:00.000Z',
			workoutId: 'A',
			exerciseName: 'Primary: Bench Press',
			liftId: 'bench',
			setNumber: 1,
			setType: 'work',
			plannedWeight: 200,
			plannedReps: 5,
			actualWeight: 200,
			actualReps: 6,
			completed: true,
			category: 'strength',
			...overrides,
		};
	}

	it('returns null when no rows match the workout ID', () => {
		const rows = [makeRow({ workoutId: 'B' })];
		expect(findPreviousWorkoutSets(rows, 'A')).toBeNull();
	});

	it('returns null for empty row array', () => {
		expect(findPreviousWorkoutSets([], 'A')).toBeNull();
	});

	it('returns sets from the most recent session', () => {
		const olderSession = [
			makeRow({ startTime: '2026-03-21T18:00:00.000Z', setNumber: 1, actualWeight: 185, actualReps: 5 }),
			makeRow({ startTime: '2026-03-21T18:00:00.000Z', setNumber: 2, actualWeight: 185, actualReps: 4 }),
		];
		const newerSession = [
			makeRow({ startTime: '2026-03-28T18:00:00.000Z', setNumber: 1, actualWeight: 200, actualReps: 6 }),
			makeRow({ startTime: '2026-03-28T18:00:00.000Z', setNumber: 2, actualWeight: 200, actualReps: 5 }),
		];
		const result = findPreviousWorkoutSets([...olderSession, ...newerSession], 'A');
		expect(result).toEqual([
			[
				{ weight: 200, reps: 6 },
				{ weight: 200, reps: 5 },
			],
		]);
	});

	it('groups sets by exercise, preserving exercise order', () => {
		const rows = [
			makeRow({ exerciseName: 'Primary: Bench Press', setNumber: 1, actualWeight: 200, actualReps: 5 }),
			makeRow({ exerciseName: 'Primary: Bench Press', setNumber: 2, actualWeight: 200, actualReps: 5 }),
			makeRow({ exerciseName: 'Secondary: Squat', setNumber: 1, actualWeight: 300, actualReps: 3 }),
			makeRow({ exerciseName: 'Secondary: Squat', setNumber: 2, actualWeight: 255, actualReps: 5 }),
		];
		const result = findPreviousWorkoutSets(rows, 'A');
		expect(result).toEqual([
			[
				{ weight: 200, reps: 5 },
				{ weight: 200, reps: 5 },
			],
			[
				{ weight: 300, reps: 3 },
				{ weight: 255, reps: 5 },
			],
		]);
	});

	it('sorts sets by setNumber within each exercise', () => {
		const rows = [
			makeRow({ setNumber: 3, actualWeight: 180, actualReps: 8 }),
			makeRow({ setNumber: 1, actualWeight: 200, actualReps: 5 }),
			makeRow({ setNumber: 2, actualWeight: 190, actualReps: 5 }),
		];
		const result = findPreviousWorkoutSets(rows, 'A');
		expect(result).toEqual([
			[
				{ weight: 200, reps: 5 },
				{ weight: 190, reps: 5 },
				{ weight: 180, reps: 8 },
			],
		]);
	});

	it('filters by workout ID and ignores other workouts', () => {
		const rows = [
			makeRow({ workoutId: 'A', exerciseName: 'Bench', setNumber: 1, actualWeight: 200, actualReps: 5 }),
			makeRow({ workoutId: 'B', exerciseName: 'Squat', setNumber: 1, actualWeight: 300, actualReps: 3 }),
		];
		const result = findPreviousWorkoutSets(rows, 'A');
		expect(result).toEqual([
			[{ weight: 200, reps: 5 }],
		]);
	});

	it('handles a single set in a single exercise', () => {
		const rows = [makeRow({ actualWeight: 135, actualReps: 10 })];
		const result = findPreviousWorkoutSets(rows, 'A');
		expect(result).toEqual([
			[{ weight: 135, reps: 10 }],
		]);
	});

	it('handles multiple exercises with varying set counts', () => {
		const rows = [
			makeRow({ exerciseName: 'Bench', setNumber: 1, actualWeight: 200, actualReps: 5 }),
			makeRow({ exerciseName: 'Bench', setNumber: 2, actualWeight: 200, actualReps: 5 }),
			makeRow({ exerciseName: 'Bench', setNumber: 3, actualWeight: 200, actualReps: 4 }),
			makeRow({ exerciseName: 'Curl', setNumber: 1, actualWeight: 30, actualReps: 12 }),
		];
		const result = findPreviousWorkoutSets(rows, 'A');
		expect(result).toHaveLength(2);
		expect(result![0]).toHaveLength(3);
		expect(result![1]).toHaveLength(1);
	});
});
