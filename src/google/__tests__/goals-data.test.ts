import { describe, it, expect } from 'vitest'
import { parseGoalRow, garminGoalToRow } from '../sheets.ts'

/* ------------------------------------------------------------------ */
/*  parseGoalRow                                                        */
/* ------------------------------------------------------------------ */

describe('parseGoalRow', () => {
	it('parses a valid goal row', () => {
		expect(parseGoalRow(['distance', '1000'])).toEqual({
			metric: 'distance',
			value: 1000,
		})
	})

	it('parses elevationGain metric', () => {
		expect(parseGoalRow(['elevationGain', '200000'])).toEqual({
			metric: 'elevationGain',
			value: 200000,
		})
	})

	it('parses duration metric', () => {
		expect(parseGoalRow(['duration', '500'])).toEqual({
			metric: 'duration',
			value: 500,
		})
	})

	it('returns null for unknown metric', () => {
		expect(parseGoalRow(['speed', '100'])).toBeNull()
	})

	it('returns null for empty row', () => {
		expect(parseGoalRow([])).toBeNull()
	})

	it('returns null for short row', () => {
		expect(parseGoalRow(['distance'])).toBeNull()
	})

	it('returns null for non-numeric value', () => {
		expect(parseGoalRow(['distance', 'abc'])).toBeNull()
	})

	it('returns null for zero value', () => {
		expect(parseGoalRow(['distance', '0'])).toBeNull()
	})

	it('returns null for negative value', () => {
		expect(parseGoalRow(['distance', '-100'])).toBeNull()
	})

	it('trims whitespace', () => {
		expect(parseGoalRow([' distance ', ' 1000 '])).toEqual({
			metric: 'distance',
			value: 1000,
		})
	})

	it('returns null for empty metric', () => {
		expect(parseGoalRow(['', '1000'])).toBeNull()
	})

	it('returns null for empty value', () => {
		expect(parseGoalRow(['distance', ''])).toBeNull()
	})
})

/* ------------------------------------------------------------------ */
/*  garminGoalToRow                                                     */
/* ------------------------------------------------------------------ */

describe('garminGoalToRow', () => {
	it('serializes a goal to a row', () => {
		expect(garminGoalToRow({ metric: 'distance', value: 1000 }))
			.toEqual(['distance', '1000'])
	})

	it('serializes a decimal value', () => {
		expect(garminGoalToRow({ metric: 'duration', value: 500.5 }))
			.toEqual(['duration', '500.5'])
	})

	it('round-trips through parse', () => {
		const goal = { metric: 'elevationGain' as const, value: 200000 }
		const row = garminGoalToRow(goal)
		expect(parseGoalRow(row)).toEqual(goal)
	})
})
