import { describe, it, expect } from 'vitest'
import { generateEventDates, buildDeepLink, getEventDate } from '../calendar.ts'

describe('generateEventDates', () => {
	it('generates one date per week for Monday (dayIndex 0)', () => {
		const dates = generateEventDates('2026-04-06', 0, 3)
		expect(dates).toEqual(['2026-04-06', '2026-04-13', '2026-04-20'])
	})

	it('generates dates for Wednesday (dayIndex 2)', () => {
		const dates = generateEventDates('2026-04-06', 2, 2)
		expect(dates).toEqual(['2026-04-08', '2026-04-15'])
	})

	it('generates dates for Sunday (dayIndex 6)', () => {
		const dates = generateEventDates('2026-04-06', 6, 2)
		expect(dates).toEqual(['2026-04-12', '2026-04-19'])
	})

	it('handles a single week', () => {
		const dates = generateEventDates('2026-04-06', 4, 1)
		expect(dates).toEqual(['2026-04-10'])
	})

	it('returns empty array for zero weeks', () => {
		const dates = generateEventDates('2026-04-06', 0, 0)
		expect(dates).toEqual([])
	})

	it('rolls over month boundaries', () => {
		const dates = generateEventDates('2026-04-27', 0, 2)
		expect(dates).toEqual(['2026-04-27', '2026-05-04'])
	})

	it('rolls over year boundaries', () => {
		const dates = generateEventDates('2026-12-28', 0, 2)
		expect(dates).toEqual(['2026-12-28', '2027-01-04'])
	})
})

describe('buildDeepLink', () => {
	const base = 'https://example.github.io/stronger/'

	it('builds a workout deep link', () => {
		const link = buildDeepLink('squat-a', base)
		expect(link).toBe('https://example.github.io/stronger/#/workout/squat-a')
	})

	it('encodes special characters in workout IDs', () => {
		const link = buildDeepLink('bench press/heavy', base)
		expect(link).toBe('https://example.github.io/stronger/#/workout/bench%20press%2Fheavy')
	})
})

describe('getEventDate', () => {
	it('extracts date from all-day event', () => {
		expect(getEventDate({ start: { date: '2026-04-10' } })).toBe('2026-04-10')
	})

	it('extracts date from timed event', () => {
		expect(getEventDate({ start: { dateTime: '2026-04-10T14:00:00Z' } })).toBe('2026-04-10')
	})

	it('prefers date over dateTime', () => {
		expect(getEventDate({ start: { date: '2026-04-10', dateTime: '2026-04-11T09:00:00Z' } })).toBe('2026-04-10')
	})

	it('returns undefined when start is missing', () => {
		expect(getEventDate({})).toBeUndefined()
	})

	it('returns undefined when start has no date fields', () => {
		expect(getEventDate({ start: {} })).toBeUndefined()
	})
})
