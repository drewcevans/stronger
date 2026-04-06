import { describe, it, expect } from 'vitest'
import { parseGarminRow, garminActivityToRow } from '../sheets.ts'

/* ------------------------------------------------------------------ */
/*  parseGarminRow                                                      */
/* ------------------------------------------------------------------ */

describe('parseGarminRow', () => {
	it('parses a valid Garmin row', () => {
		expect(
			parseGarminRow([
				'2026-04-01', '12345678', 'Run', 'Morning Run',
				'1800', '5000', '50', '300', '145', '170',
			]),
		).toEqual({
			date: '2026-04-01',
			stravaId: '12345678',
			activityType: 'Run',
			name: 'Morning Run',
			duration: 1800,
			distance: 5000,
			elevationGain: 50,
			calories: 300,
			avgHR: 145,
			maxHR: 170,
		})
	})

	it('trims whitespace', () => {
		expect(
			parseGarminRow([
				' 2026-04-01 ', ' 12345678 ', ' Run ', ' Morning Run ',
				' 1800 ', ' 5000 ', ' 50 ', ' 300 ', ' 145 ', ' 170 ',
			]),
		).toEqual({
			date: '2026-04-01',
			stravaId: '12345678',
			activityType: 'Run',
			name: 'Morning Run',
			duration: 1800,
			distance: 5000,
			elevationGain: 50,
			calories: 300,
			avgHR: 145,
			maxHR: 170,
		})
	})

	it('accepts zero values for numeric fields', () => {
		const result = parseGarminRow([
			'2026-04-01', '12345678', 'WeightTraining', 'Gym Session',
			'3600', '0', '0', '0', '0', '0',
		])
		expect(result).not.toBeNull()
		expect(result!.distance).toBe(0)
		expect(result!.elevationGain).toBe(0)
		expect(result!.calories).toBe(0)
		expect(result!.avgHR).toBe(0)
		expect(result!.maxHR).toBe(0)
	})

	it('allows empty name', () => {
		const result = parseGarminRow([
			'2026-04-01', '12345678', 'Run', '',
			'1800', '5000', '50', '300', '145', '170',
		])
		expect(result).not.toBeNull()
		expect(result!.name).toBe('')
	})

	it('returns null for empty row', () => {
		expect(parseGarminRow([])).toBeNull()
	})

	it('returns null for row with fewer than 10 columns', () => {
		expect(parseGarminRow(['2026-04-01', '12345678', 'Run'])).toBeNull()
	})

	it('returns null for empty date', () => {
		expect(
			parseGarminRow(['', '12345678', 'Run', 'Run', '1800', '5000', '50', '300', '145', '170']),
		).toBeNull()
	})

	it('returns null for empty stravaId', () => {
		expect(
			parseGarminRow(['2026-04-01', '', 'Run', 'Run', '1800', '5000', '50', '300', '145', '170']),
		).toBeNull()
	})

	it('returns null for empty activityType', () => {
		expect(
			parseGarminRow(['2026-04-01', '12345678', '', 'Run', '1800', '5000', '50', '300', '145', '170']),
		).toBeNull()
	})

	it('returns null for invalid date format', () => {
		expect(
			parseGarminRow(['Apr 1 2026', '12345678', 'Run', 'Run', '1800', '5000', '50', '300', '145', '170']),
		).toBeNull()
		expect(
			parseGarminRow(['2026/04/01', '12345678', 'Run', 'Run', '1800', '5000', '50', '300', '145', '170']),
		).toBeNull()
	})

	it('returns null for negative numeric values', () => {
		expect(
			parseGarminRow(['2026-04-01', '12345678', 'Run', 'Run', '-1', '5000', '50', '300', '145', '170']),
		).toBeNull()
	})

	it('returns null for non-numeric values in numeric fields', () => {
		expect(
			parseGarminRow(['2026-04-01', '12345678', 'Run', 'Run', 'abc', '5000', '50', '300', '145', '170']),
		).toBeNull()
	})

	it('returns null for null input', () => {
		expect(parseGarminRow(null as unknown as string[])).toBeNull()
	})

	it('accepts decimal numeric values', () => {
		const result = parseGarminRow([
			'2026-04-01', '12345678', 'Ride', 'Bike Ride',
			'3600.5', '25000.75', '150.2', '500.5', '140.3', '175.8',
		])
		expect(result).not.toBeNull()
		expect(result!.duration).toBeCloseTo(3600.5)
		expect(result!.distance).toBeCloseTo(25000.75)
	})
})

/* ------------------------------------------------------------------ */
/*  garminActivityToRow                                                 */
/* ------------------------------------------------------------------ */

describe('garminActivityToRow', () => {
	it('converts a GarminActivity to a spreadsheet row', () => {
		expect(
			garminActivityToRow({
				date: '2026-04-01',
				stravaId: '12345678',
				activityType: 'Run',
				name: 'Morning Run',
				duration: 1800,
				distance: 5000,
				elevationGain: 50,
				calories: 300,
				avgHR: 145,
				maxHR: 170,
			}),
		).toEqual([
			'2026-04-01', '12345678', 'Run', 'Morning Run',
			'1800', '5000', '50', '300', '145', '170',
		])
	})

	it('converts zero numeric values', () => {
		expect(
			garminActivityToRow({
				date: '2026-04-01',
				stravaId: '12345678',
				activityType: 'WeightTraining',
				name: 'Gym',
				duration: 3600,
				distance: 0,
				elevationGain: 0,
				calories: 0,
				avgHR: 0,
				maxHR: 0,
			}),
		).toEqual([
			'2026-04-01', '12345678', 'WeightTraining', 'Gym',
			'3600', '0', '0', '0', '0', '0',
		])
	})

	it('round-trips through parseGarminRow', () => {
		const activities = [
			{
				date: '2026-04-01',
				stravaId: '12345678',
				activityType: 'Run',
				name: 'Morning Run',
				duration: 1800,
				distance: 5000,
				elevationGain: 50,
				calories: 300,
				avgHR: 145,
				maxHR: 170,
			},
			{
				date: '2026-03-15',
				stravaId: '87654321',
				activityType: 'Ride',
				name: 'Weekend Ride',
				duration: 7200,
				distance: 40000,
				elevationGain: 500,
				calories: 800,
				avgHR: 135,
				maxHR: 165,
			},
		]
		for (const activity of activities) {
			const row = garminActivityToRow(activity)
			expect(parseGarminRow(row)).toEqual(activity)
		}
	})
})
