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

	it('returns null for row with only one column and no flags', () => {
		expect(parseScheduleRow(['2025-01-15'])).toBeNull()
	})

	it('returns null for empty date', () => {
		expect(parseScheduleRow(['', 'A'])).toBeNull()
	})

	it('returns null for empty workoutId and no flags', () => {
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
		expect(parseScheduleRow(['2025-01-15', 'A', '', '', '', '', 'extra'])).toEqual({
			date: '2025-01-15',
			workoutId: 'A',
		})
	})

	it('parses flag columns', () => {
		expect(parseScheduleRow(['2025-01-15', 'A', 'TRUE', '', 'TRUE', '', ''])).toEqual({
			date: '2025-01-15',
			workoutId: 'A',
			flags: { home: true, elsewhere: false, travel: true, visitors: false, blocked: false },
		})
	})

	it('accepts flag-only rows (no workoutId)', () => {
		expect(parseScheduleRow(['2025-01-15', '', 'TRUE', '', '', '', ''])).toEqual({
			date: '2025-01-15',
			workoutId: '',
			flags: { home: true, elsewhere: false, travel: false, visitors: false, blocked: false },
		})
	})

	it('returns null for row with no workoutId and no flags', () => {
		expect(parseScheduleRow(['2025-01-15', '', '', '', '', '', ''])).toBeNull()
	})

	it('parses blocked flag', () => {
		expect(parseScheduleRow(['2025-01-15', '', '', '', '', '', 'TRUE'])).toEqual({
			date: '2025-01-15',
			workoutId: '',
			flags: { home: false, elsewhere: false, travel: false, visitors: false, blocked: true },
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
			'',
			'',
			'',
			'',
			'',
		])
	})

	it('converts a schedule entry with flags', () => {
		expect(
			scheduleEntryToRow({
				date: '2025-01-15',
				workoutId: 'A',
				flags: { home: true, elsewhere: false, travel: true, visitors: false, blocked: false },
			}),
		).toEqual(['2025-01-15', 'A', 'TRUE', '', 'TRUE', '', ''])
	})

	it('converts a flag-only row', () => {
		expect(
			scheduleEntryToRow({
				date: '2025-01-15',
				workoutId: '',
				flags: { home: false, elsewhere: true, travel: false, visitors: true, blocked: false },
			}),
		).toEqual(['2025-01-15', '', '', 'TRUE', '', 'TRUE', ''])
	})

	it('converts a blocked flag row', () => {
		expect(
			scheduleEntryToRow({
				date: '2025-01-15',
				workoutId: '',
				flags: { home: false, elsewhere: false, travel: false, visitors: false, blocked: true },
			}),
		).toEqual(['2025-01-15', '', '', '', '', '', 'TRUE'])
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

	it('round-trips entries with flags', () => {
		const entry = {
			date: '2025-01-15',
			workoutId: 'A',
			flags: { home: true, elsewhere: false, travel: false, visitors: true, blocked: false },
		}
		const row = scheduleEntryToRow(entry)
		expect(parseScheduleRow(row)).toEqual(entry)
	})

	it('round-trips blocked flag', () => {
		const entry = {
			date: '2025-01-15',
			workoutId: '',
			flags: { home: false, elsewhere: false, travel: false, visitors: false, blocked: true },
		}
		const row = scheduleEntryToRow(entry)
		expect(parseScheduleRow(row)).toEqual(entry)
	})
})
