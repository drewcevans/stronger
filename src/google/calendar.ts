/**
 * Google Calendar integration.
 *
 * Provides helpers to list the user's writable calendars and to push
 * workout events as all-day entries with deep links back to the app.
 */

import type { CalendarListEntry, CalendarEventResource, CalendarEventItem } from './types.ts'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface WeeklySlot {
	/** 0 = Monday, 6 = Sunday */
	dayIndex: number
	workoutId: string
	workoutName: string
	/** 'strength' or 'cardio' — determines the deep-link route. */
	category: 'strength' | 'cardio'
}

export interface CalendarPushRequest {
	calendarId: string
	slots: WeeklySlot[]
	/** Start date in YYYY-MM-DD format (should be a Monday). */
	startDate: string
	/** Number of weeks to generate events for. */
	weeks: number
}

export interface CalendarPushResult {
	created: number
	skipped: number
	failed: number
	errors: string[]
}

/* ------------------------------------------------------------------ */
/*  Calendar list                                                      */
/* ------------------------------------------------------------------ */

/**
 * List Google Calendars the user can write to.
 * Returns entries where accessRole is 'writer' or 'owner'.
 */
export async function listWritableCalendars(): Promise<CalendarListEntry[]> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	const response = await gapi.client.calendar.calendarList.list()
	const items = response.result.items ?? []
	return items.filter(
		(c: CalendarListEntry) => c.accessRole === 'writer' || c.accessRole === 'owner',
	)
}

/* ------------------------------------------------------------------ */
/*  Existing event lookup                                              */
/* ------------------------------------------------------------------ */

/**
 * Fetch all events in a date range from a Google Calendar.
 *
 * Returns the raw event items so the caller can check for duplicates.
 */
async function listEventsInRange(
	calendarId: string,
	startDate: string,
	endDate: string,
): Promise<CalendarEventItem[]> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	const response = await gapi.client.calendar.events.list({
		calendarId,
		timeMin: `${startDate}T00:00:00Z`,
		timeMax: `${endDate}T00:00:00Z`,
		singleEvents: true,
		maxResults: 2500,
	})
	return response.result.items ?? []
}

/**
 * Build a set of "date|summary" keys from existing calendar events
 * for fast duplicate lookup.
 */
function buildExistingEventKeys(events: CalendarEventItem[]): Set<string> {
	const keys = new Set<string>()
	for (const e of events) {
		const date = e.start?.date ?? e.start?.dateTime?.slice(0, 10)
		const summary = e.summary
		if (date && summary) {
			keys.add(`${date}|${summary}`)
		}
	}
	return keys
}

/* ------------------------------------------------------------------ */
/*  Event creation                                                     */
/* ------------------------------------------------------------------ */

/**
 * Build a deep link URL for a workout.
 *
 * In the browser, derives the base URL from `window.location.href`.
 * An explicit `baseUrl` can be passed for testing environments where
 * `window.location` is not available.
 */
export function buildDeepLink(
	workoutId: string,
	category: 'strength' | 'cardio',
	baseUrl?: string,
): string {
	const base = baseUrl ?? window.location.href.split('#')[0]
	const route = category === 'cardio' ? 'cardio' : 'workout'
	return `${base}#/${route}/${encodeURIComponent(workoutId)}`
}

/**
 * Generate the list of dates (YYYY-MM-DD) for a weekly slot across N weeks.
 *
 * `startDate` is the Monday of the first week. `dayIndex` is 0-based
 * from Monday (0 = Mon, 6 = Sun). Returns one date per week.
 */
export function generateEventDates(
	startDate: string,
	dayIndex: number,
	weeks: number,
): string[] {
	const [y, m, d] = startDate.split('-').map(Number)
	const base = new Date(y, m - 1, d)
	const dates: string[] = []
	for (let w = 0; w < weeks; w++) {
		const date = new Date(
			base.getFullYear(),
			base.getMonth(),
			base.getDate() + w * 7 + dayIndex,
		)
		const yyyy = date.getFullYear()
		const mm = String(date.getMonth() + 1).padStart(2, '0')
		const dd = String(date.getDate()).padStart(2, '0')
		dates.push(`${yyyy}-${mm}-${dd}`)
	}
	return dates
}

/**
 * Push workout events to a Google Calendar.
 *
 * Creates one all-day event per scheduled slot per week. Each event
 * title is the workout name, and the description contains a deep link.
 */
export async function pushEventsToCalendar(
	request: CalendarPushRequest,
): Promise<CalendarPushResult> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	const result: CalendarPushResult = { created: 0, skipped: 0, failed: 0, errors: [] }

	// Compute the end date of the entire range for the existing-event query.
	const [sy, sm, sd] = request.startDate.split('-').map(Number)
	const rangeEnd = new Date(sy, sm - 1, sd + request.weeks * 7)
	const endDate = `${rangeEnd.getFullYear()}-${String(rangeEnd.getMonth() + 1).padStart(2, '0')}-${String(rangeEnd.getDate()).padStart(2, '0')}`

	// Fetch existing events in the range to avoid duplicates.
	let existingKeys: Set<string>
	try {
		const existing = await listEventsInRange(request.calendarId, request.startDate, endDate)
		existingKeys = buildExistingEventKeys(existing)
	} catch {
		// If listing fails, proceed without dedup rather than blocking the push.
		existingKeys = new Set()
	}

	for (const slot of request.slots) {
		const dates = generateEventDates(request.startDate, slot.dayIndex, request.weeks)
		const deepLink = buildDeepLink(slot.workoutId, slot.category)

		for (const date of dates) {
			// Skip if this workout already exists on this date.
			if (existingKeys.has(`${date}|${slot.workoutName}`)) {
				result.skipped++
				continue
			}

			const event: CalendarEventResource = {
				summary: slot.workoutName,
				description: `Open workout: ${deepLink}`,
				start: { date },
				end: { date },
			}

			try {
				await gapi.client.calendar.events.insert({
					calendarId: request.calendarId,
					resource: event,
				})
				result.created++
			} catch (err: unknown) {
				result.failed++
				const message = err instanceof Error ? err.message : String(err)
				result.errors.push(`${slot.workoutName} on ${date}: ${message}`)
			}
		}
	}

	return result
}
