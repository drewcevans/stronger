import { describe, it, expect } from 'vitest';
import { generatePastDays, groupLogByDate, buildDayInfos } from '../CalendarView.js';
import type { LogSession } from '../CalendarView.js';
import type { ParsedLogRow } from '../../google/index.js';

describe('generatePastDays', () => {
	it('generates the correct number of past days', () => {
		const result = generatePastDays('2026-04-04', 3);
		expect(result).toEqual(['2026-04-03', '2026-04-02', '2026-04-01']);
	});

	it('handles month boundaries', () => {
		const result = generatePastDays('2026-03-02', 3);
		expect(result).toEqual(['2026-03-01', '2026-02-28', '2026-02-27']);
	});

	it('returns empty array for count 0', () => {
		const result = generatePastDays('2026-04-04', 0);
		expect(result).toEqual([]);
	});

	it('handles year boundaries', () => {
		const result = generatePastDays('2026-01-02', 3);
		expect(result).toEqual(['2026-01-01', '2025-12-31', '2025-12-30']);
	});
});

function makeLogRow(overrides: Partial<ParsedLogRow> = {}): ParsedLogRow {
	return {
		date: '2026-04-01',
		startTime: '2026-04-01T10:00:00.000Z',
		endTime: '2026-04-01T11:00:00.000Z',
		workoutId: 'workout-a',
		exerciseName: 'Bench Press',
		liftId: 'bench',
		setNumber: 1,
		setType: 'work',
		plannedWeight: 185,
		plannedReps: 5,
		actualWeight: 185,
		actualReps: 5,
		completed: true,
		category: 'strength',
		...overrides,
	};
}

describe('groupLogByDate', () => {
	it('groups rows by date and session', () => {
		const rows: ParsedLogRow[] = [
			makeLogRow({ setNumber: 1 }),
			makeLogRow({ setNumber: 2 }),
			makeLogRow({ date: '2026-04-02', startTime: '2026-04-02T09:00:00.000Z' }),
		];

		const result = groupLogByDate(rows);
		expect(result.size).toBe(2);
		expect(result.get('2026-04-01')!.length).toBe(1); // 1 session
		expect(result.get('2026-04-01')![0].rows.length).toBe(2); // 2 sets
		expect(result.get('2026-04-02')!.length).toBe(1);
	});

	it('separates different workouts on the same day', () => {
		const rows: ParsedLogRow[] = [
			makeLogRow({ workoutId: 'a', startTime: '2026-04-01T10:00:00.000Z' }),
			makeLogRow({ workoutId: 'b', startTime: '2026-04-01T14:00:00.000Z' }),
		];

		const result = groupLogByDate(rows);
		expect(result.get('2026-04-01')!.length).toBe(2);
	});

	it('returns empty map for empty input', () => {
		const result = groupLogByDate([]);
		expect(result.size).toBe(0);
	});

	it('correctly identifies cardio sessions', () => {
		const rows: ParsedLogRow[] = [
			makeLogRow({ category: 'cardio', workoutId: 'running' }),
		];

		const result = groupLogByDate(rows);
		const sessions = result.get('2026-04-01')!;
		expect(sessions[0].category).toBe('cardio');
	});
});

describe('buildDayInfos', () => {
	it('merges schedule and log data for each date', () => {
		const dates = ['2026-04-01', '2026-04-02', '2026-04-03'];
		const scheduleMap = new Map<string, string[]>([
			['2026-04-01', ['workout-a']],
			['2026-04-02', ['workout-b']],
		]);

		const session: LogSession = {
			key: { date: '2026-04-01', workoutId: 'workout-a', startTime: '2026-04-01T10:00:00.000Z' },
			workoutName: 'Bench Press',
			category: 'strength',
			rows: [makeLogRow()],
		};

		const logByDate = new Map([['2026-04-01', [session]]]);

		const result = buildDayInfos(dates, scheduleMap, logByDate);
		expect(result.length).toBe(3);

		// Day 1: scheduled + logged
		expect(result[0].scheduled).toEqual(['workout-a']);
		expect(result[0].sessions.length).toBe(1);

		// Day 2: scheduled only
		expect(result[1].scheduled).toEqual(['workout-b']);
		expect(result[1].sessions.length).toBe(0);

		// Day 3: neither
		expect(result[2].scheduled).toEqual([]);
		expect(result[2].sessions.length).toBe(0);
	});

	it('includes unscheduled logged sessions', () => {
		const dates = ['2026-04-01'];
		const scheduleMap = new Map<string, string[]>();
		const session: LogSession = {
			key: { date: '2026-04-01', workoutId: 'workout-x', startTime: '2026-04-01T10:00:00.000Z' },
			workoutName: 'Unscheduled Workout',
			category: 'strength',
			rows: [makeLogRow({ workoutId: 'workout-x' })],
		};
		const logByDate = new Map([['2026-04-01', [session]]]);

		const result = buildDayInfos(dates, scheduleMap, logByDate);
		expect(result[0].scheduled).toEqual([]);
		expect(result[0].sessions.length).toBe(1);
	});
});
