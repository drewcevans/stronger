import { describe, it, expect } from 'vitest'
import { goalsFromSettings, goalsToSettings } from '../sheets.ts'

/* ------------------------------------------------------------------ */
/*  goalsFromSettings                                                   */
/* ------------------------------------------------------------------ */

describe('goalsFromSettings', () => {
	it('extracts goals from settings map', () => {
		const settings = new Map([
			['goal.distance', '1000'],
			['goal.elevationGain', '200000'],
			['goal.duration', '500'],
		])
		expect(goalsFromSettings(settings)).toEqual([
			{ metric: 'distance', value: 1000 },
			{ metric: 'elevationGain', value: 200000 },
			{ metric: 'duration', value: 500 },
		])
	})

	it('ignores non-goal keys', () => {
		const settings = new Map([
			['theme', 'dark'],
			['goal.distance', '1000'],
			['language', 'en'],
		])
		expect(goalsFromSettings(settings)).toEqual([
			{ metric: 'distance', value: 1000 },
		])
	})

	it('returns empty array for empty settings', () => {
		expect(goalsFromSettings(new Map())).toEqual([])
	})

	it('skips invalid metric names', () => {
		const settings = new Map([
			['goal.speed', '100'],
			['goal.distance', '500'],
		])
		expect(goalsFromSettings(settings)).toEqual([
			{ metric: 'distance', value: 500 },
		])
	})

	it('skips non-numeric values', () => {
		const settings = new Map([
			['goal.distance', 'abc'],
		])
		expect(goalsFromSettings(settings)).toEqual([])
	})

	it('skips zero values', () => {
		const settings = new Map([
			['goal.distance', '0'],
		])
		expect(goalsFromSettings(settings)).toEqual([])
	})

	it('skips negative values', () => {
		const settings = new Map([
			['goal.distance', '-100'],
		])
		expect(goalsFromSettings(settings)).toEqual([])
	})

	it('handles decimal values', () => {
		const settings = new Map([
			['goal.duration', '500.5'],
		])
		expect(goalsFromSettings(settings)).toEqual([
			{ metric: 'duration', value: 500.5 },
		])
	})
})

/* ------------------------------------------------------------------ */
/*  goalsToSettings                                                     */
/* ------------------------------------------------------------------ */

describe('goalsToSettings', () => {
	it('writes goals into an empty settings map', () => {
		const settings = new Map<string, string>()
		goalsToSettings(
			[{ metric: 'distance', value: 1000 }],
			settings,
		)
		expect(settings.get('goal.distance')).toBe('1000')
	})

	it('preserves non-goal settings', () => {
		const settings = new Map([
			['theme', 'dark'],
			['language', 'en'],
		])
		goalsToSettings(
			[{ metric: 'distance', value: 1000 }],
			settings,
		)
		expect(settings.get('theme')).toBe('dark')
		expect(settings.get('language')).toBe('en')
		expect(settings.get('goal.distance')).toBe('1000')
	})

	it('removes old goals when replacing', () => {
		const settings = new Map([
			['goal.distance', '500'],
			['goal.elevationGain', '100000'],
		])
		goalsToSettings(
			[{ metric: 'distance', value: 1000 }],
			settings,
		)
		expect(settings.get('goal.distance')).toBe('1000')
		expect(settings.has('goal.elevationGain')).toBe(false)
	})

	it('clears all goals when given empty array', () => {
		const settings = new Map([
			['goal.distance', '500'],
			['theme', 'dark'],
		])
		goalsToSettings([], settings)
		expect(settings.has('goal.distance')).toBe(false)
		expect(settings.get('theme')).toBe('dark')
	})

	it('round-trips through goalsFromSettings', () => {
		const goals = [
			{ metric: 'distance' as const, value: 1000 },
			{ metric: 'elevationGain' as const, value: 200000 },
		]
		const settings = new Map<string, string>()
		goalsToSettings(goals, settings)
		expect(goalsFromSettings(settings)).toEqual(goals)
	})

	it('returns the mutated settings map', () => {
		const settings = new Map<string, string>()
		const result = goalsToSettings(
			[{ metric: 'duration', value: 500 }],
			settings,
		)
		expect(result).toBe(settings)
	})
})
