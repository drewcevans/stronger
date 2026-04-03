import { describe, it, expect } from 'vitest'
import { parseScheduleRow, scheduleEntryToRow } from '../sheets.ts'

/* ------------------------------------------------------------------ */
/*  parseScheduleRow                                                    */
/* ------------------------------------------------------------------ */

describe('parseScheduleRow', () => {
	it('parses a valid schedule row', () => {
		expect(parseScheduleRow(['2025-01-15', 'A'])).toEqual({
			date: '2025-01-15',
			workoutId: 'A',
		})
	})

	it('trims whitespace', () => {
		expect(parseScheduleRow([' 2025-03-01 ', ' B '])).toEqual({
			date: '2025-03-01',
			workoutId: 'B',
		})
	})

	it('returns null for empty row', () => {
		expect(parseScheduleRow([])).toBeNull()
	})

	it('returns null for row with only one column', () => {
		expect(parseScheduleRow(['2025-01-15'])).toBeNull()
	})

	it('returns null for empty date', () => {
		expect(parseScheduleRow(['', 'A'])).toBeNull()
	})

	it('returns null for empty workoutId', () => {
		expect(parseScheduleRow(['2025-01-15', ''])).toBeNull()
	})

	it('returns null for invalid date format', () => {
		expect(parseScheduleRow(['Jan 15 2025', 'A'])).toBeNull()
		expect(parseScheduleRow(['2025/01/15', 'A'])).toBeNull()
		expect(parseScheduleRow(['15-01-2025', 'A'])).toBeNull()
	})

	it('returns null for null input', () => {
		expect(parseScheduleRow(null as unknown as string[])).toBeNull()
	})

	it('accepts rows with extra columns (ignores them)', () => {
		expect(parseScheduleRow(['2025-01-15', 'A', 'extra'])).toEqual({
			date: '2025-01-15',
			workoutId: 'A',
		})
	})
})

/* ------------------------------------------------------------------ */
/*  scheduleEntryToRow                                                  */
/* ------------------------------------------------------------------ */

describe('scheduleEntryToRow', () => {
	it('converts a schedule entry to a spreadsheet row', () => {
		expect(scheduleEntryToRow({ date: '2025-01-15', workoutId: 'A' })).toEqual([
			'2025-01-15',
			'A',
		])
	})

	it('round-trips through parseScheduleRow', () => {
		const entries = [
			{ date: '2025-01-15', workoutId: 'A' },
			{ date: '2025-03-01', workoutId: 'B' },
			{ date: '2025-12-25', workoutId: 'C' },
		]
		for (const entry of entries) {
			const row = scheduleEntryToRow(entry)
			expect(parseScheduleRow(row)).toEqual(entry)
		}
	})
})
