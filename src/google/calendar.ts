/**
 * Google Calendar integration.
 *
 * Provides helpers to list the user's writable calendars, push
 * workout events as all-day entries with deep links back to the app,
 * and perform two-way sync between the schedule sheet and Google Calendar.
 */

import type { CalendarListEntry, CalendarEventResource, CalendarEventItem } from './types.ts'
import type { ScheduleEntry } from '../model/types.ts'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface WeeklySlot {
	/** 0 = Monday, 6 = Sunday */
	dayIndex: number
	workoutId: string
	workoutName: string
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
	baseUrl?: string,
): string {
	const base = baseUrl ?? window.location.href.split('#')[0]
	return `${base}#/workout/${encodeURIComponent(workoutId)}`
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

/** A single date→workout entry to push as a calendar event. */
export interface ScheduleCalendarEntry {
	date: string
	workoutId: string
	workoutName: string
}

export interface SchedulePushRequest {
	calendarId: string
	entries: ScheduleCalendarEntry[]
}

/**
 * Push individual schedule entries to a Google Calendar.
 *
 * Creates one all-day event per entry. Skips entries whose
 * workout name already exists on the same date (duplicate detection).
 */
export async function pushScheduleToCalendar(
	request: SchedulePushRequest,
): Promise<CalendarPushResult> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	const result: CalendarPushResult = { created: 0, skipped: 0, failed: 0, errors: [] }
	if (request.entries.length === 0) return result

	// Compute the date range for existing-event query.
	const dates = request.entries.map((e) => e.date).sort()
	const startDate = dates[0]
	const [ey, em, ed] = dates[dates.length - 1].split('-').map(Number)
	const rangeEnd = new Date(ey, em - 1, ed + 1)
	const endDate = `${rangeEnd.getFullYear()}-${String(rangeEnd.getMonth() + 1).padStart(2, '0')}-${String(rangeEnd.getDate()).padStart(2, '0')}`

	// Fetch existing events in the range to avoid duplicates.
	let existingKeys: Set<string>
	try {
		const existing = await listEventsInRange(request.calendarId, startDate, endDate)
		existingKeys = buildExistingEventKeys(existing)
	} catch {
		existingKeys = new Set()
	}

	for (const entry of request.entries) {
		if (existingKeys.has(`${entry.date}|${entry.workoutName}`)) {
			result.skipped++
			continue
		}

		const isCardio = entry.workoutId.startsWith('cardio:')
		const deepLink = isCardio ? null : buildDeepLink(entry.workoutId)
		const event: CalendarEventResource = {
			summary: entry.workoutName,
			description: deepLink ? `Open workout: ${deepLink}` : entry.workoutName,
			start: { date: entry.date },
			end: { date: entry.date },
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
			result.errors.push(`${entry.workoutName} on ${entry.date}: ${message}`)
		}
	}

	return result
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
		const isCardio = slot.workoutId.startsWith('cardio:')
		const deepLink = isCardio ? null : buildDeepLink(slot.workoutId)

		for (const date of dates) {
			// Skip if this workout already exists on this date.
			if (existingKeys.has(`${date}|${slot.workoutName}`)) {
				result.skipped++
				continue
			}

			const event: CalendarEventResource = {
				summary: slot.workoutName,
				description: deepLink ? `Open workout: ${deepLink}` : slot.workoutName,
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

/* ------------------------------------------------------------------ */
/*  Two-way calendar sync                                              */
/* ------------------------------------------------------------------ */

/** Result of a two-way sync operation. */
export interface CalendarSyncResult {
	/** Events created in Google Calendar (new schedule entries pushed). */
	created: number
	/** Events updated in Google Calendar (date changed in sheet). */
	updated: number
	/** Events deleted from Google Calendar (removed from sheet). */
	deleted: number
	/** Schedule entries updated from calendar changes (date moved in calendar). */
	pulledDateChanges: number
	/** Schedule entries removed because their calendar event was deleted. */
	pulledDeletions: number
	/** Errors encountered during sync. */
	errors: string[]
}

/** Resolves a workoutId to a human-readable name. Returns null for unknown IDs. */
export type WorkoutNameResolver = (workoutId: string) => string | null

/**
 * Build a Map from calendar event ID → CalendarEventItem for fast lookup.
 */
function buildEventMap(events: CalendarEventItem[]): Map<string, CalendarEventItem> {
	const map = new Map<string, CalendarEventItem>()
	for (const e of events) {
		if (e.id) map.set(e.id, e)
	}
	return map
}

/**
 * Extract the event date (YYYY-MM-DD) from a calendar event.
 */
export function getEventDate(event: CalendarEventItem): string | undefined {
	return event.start?.date ?? event.start?.dateTime?.slice(0, 10)
}

/**
 * Perform a two-way sync between the schedule (sheet) and Google Calendar.
 *
 * 1. Push new schedule entries (no calendarEventId) to Google Calendar.
 * 2. For entries with a calendarEventId, check if the event still exists
 *    and whether its date changed in Google Calendar → update the sheet.
 * 3. If a calendar event was deleted, remove the entry from the sheet.
 * 4. Delete calendar events whose corresponding schedule entry was removed.
 *
 * Returns the updated schedule entries (to be written to the sheet) and
 * a summary of what changed.
 */
export async function syncScheduleWithCalendar(
	calendarId: string,
	schedule: ScheduleEntry[],
	resolveWorkoutName: WorkoutNameResolver,
): Promise<{ updatedSchedule: ScheduleEntry[]; result: CalendarSyncResult }> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	const result: CalendarSyncResult = {
		created: 0,
		updated: 0,
		deleted: 0,
		pulledDateChanges: 0,
		pulledDeletions: 0,
		errors: [],
	}

	// Only sync entries with a workoutId (skip flag-only rows)
	const syncable = schedule.filter((e) => e.workoutId)
	const flagOnly = schedule.filter((e) => !e.workoutId)

	// Compute the date range for the calendar query
	const allDates = syncable.map((e) => e.date).sort()
	if (allDates.length === 0) {
		return { updatedSchedule: schedule, result }
	}

	// Extend range to ±30 days around the schedule to catch moved events
	const firstDate = allDates[0]
	const lastDate = allDates[allDates.length - 1]
	const [fy, fm, fd] = firstDate.split('-').map(Number)
	const [ly, lm, ld] = lastDate.split('-').map(Number)
	const rangeStart = new Date(fy, fm - 1, fd - 30)
	const rangeEnd = new Date(ly, lm - 1, ld + 31)
	const startStr = `${rangeStart.getFullYear()}-${String(rangeStart.getMonth() + 1).padStart(2, '0')}-${String(rangeStart.getDate()).padStart(2, '0')}`
	const endStr = `${rangeEnd.getFullYear()}-${String(rangeEnd.getMonth() + 1).padStart(2, '0')}-${String(rangeEnd.getDate()).padStart(2, '0')}`

	// Fetch all calendar events in the range
	let calendarEvents: CalendarEventItem[]
	try {
		calendarEvents = await listEventsInRange(calendarId, startStr, endStr)
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		result.errors.push(`Failed to list calendar events: ${msg}`)
		return { updatedSchedule: schedule, result }
	}

	const eventMap = buildEventMap(calendarEvents)

	// Collect IDs of events that are tracked in the schedule
	const trackedEventIds = new Set<string>()
	const updatedSyncable: ScheduleEntry[] = []

	for (const entry of syncable) {
		if (entry.calendarEventId) {
			trackedEventIds.add(entry.calendarEventId)
			const calEvent = eventMap.get(entry.calendarEventId)

			if (!calEvent || calEvent.status === 'cancelled') {
				// Event was deleted from Google Calendar → remove from schedule
				result.pulledDeletions++
				continue
			}

			// Check if the date changed in Google Calendar
			const calDate = getEventDate(calEvent)
			if (calDate && calDate !== entry.date) {
				// Date was moved in Google Calendar → update the sheet entry
				updatedSyncable.push({ ...entry, date: calDate })
				result.pulledDateChanges++
			} else {
				// No change, keep as-is
				updatedSyncable.push(entry)
			}
		} else {
			// New entry (no calendarEventId) — push to Google Calendar
			const name = resolveWorkoutName(entry.workoutId)
			if (!name) {
				// Unknown workout, keep the entry but skip pushing
				updatedSyncable.push(entry)
				continue
			}

			const isCardio = entry.workoutId.startsWith('cardio:')
			const deepLink = isCardio ? null : buildDeepLink(entry.workoutId)
			const event: CalendarEventResource = {
				summary: name,
				description: deepLink ? `Open workout: ${deepLink}` : name,
				start: { date: entry.date },
				end: { date: entry.date },
			}

			try {
				const resp = await gapi.client.calendar.events.insert({
					calendarId,
					resource: event,
				})
				updatedSyncable.push({ ...entry, calendarEventId: resp.result.id })
				result.created++
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err)
				result.errors.push(`Create event for ${name} on ${entry.date}: ${msg}`)
				updatedSyncable.push(entry)
			}
		}
	}

	// Delete calendar events that were previously tracked but whose
	// schedule entry has been removed (the entry was in the old schedule
	// but not in the new updatedSyncable).
	const remainingEventIds = new Set(
		updatedSyncable.map((e) => e.calendarEventId).filter(Boolean),
	)

	for (const calEvent of calendarEvents) {
		if (!calEvent.id) continue
		// Skip events still linked to a schedule entry
		if (remainingEventIds.has(calEvent.id)) continue
		// Only delete events that were tracked by us
		if (trackedEventIds.has(calEvent.id)) {
			try {
				await gapi.client.calendar.events.delete({
					calendarId,
					eventId: calEvent.id,
				})
				result.deleted++
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err)
				result.errors.push(`Delete event ${calEvent.id}: ${msg}`)
			}
		}
	}

	// Reassemble the full schedule: flag-only rows + synced entries
	const updatedSchedule = [...flagOnly, ...updatedSyncable]

	return { updatedSchedule, result }
}