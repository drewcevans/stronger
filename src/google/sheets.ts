/**
 * Google Sheets API helpers.
 *
 * Verifies access to a spreadsheet, ensures the "Stronger" tab exists,
 * and provides read/write operations for the config and log zones.
 */

import { TARGET_TAB_NAME, WORKOUT_DEFS_TAB_NAME, LOG_TAB_NAME, SCHEDULE_TAB_NAME } from './config.ts'
import type { LiftConfig, ComputedSet, SetResult, SetTemplate, ExerciseTemplate, ExerciseRole, WeightBasis, PreviousSetData, ScheduleEntry, ActivityType } from '../model/types.ts'
import type { WorkoutDefinition } from '../data/sample-workouts.ts'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** A1 range for the config zone (open-ended rows). */
const CONFIG_RANGE = `'${TARGET_TAB_NAME}'!A:I`

/** A1 range for the log zone header (row 1 of the log tab). */
const LOG_HEADER_RANGE = `'${LOG_TAB_NAME}'!A1:R1`

/** A1 range used for appending log data (row 2 onward). */
const LOG_APPEND_RANGE = `'${LOG_TAB_NAME}'!A2:R2`

/** A1 range for reading all log data (row 2 onward, open-ended). */
const LOG_READ_RANGE = `'${LOG_TAB_NAME}'!A2:R`

const CONFIG_HEADER: string[] = [
	'id',
	'name',
	'topSetWeight',
	'backoffWeight',
	'increment',
	'minimumWeight',
	'roundingFactor',
	'barWeight',
	'gear',
]

const LOG_HEADER: string[] = [
	'date',
	'startTime',
	'endTime',
	'workoutId',
	'exerciseName',
	'liftId',
	'setNumber',
	'setType',
	'plannedWeight',
	'plannedReps',
	'actualWeight',
	'actualReps',
	'completed',
	'category',
	'duration',
	'distance',
	'elevation',
	'cardioWeight',
]

/* ------------------------------------------------------------------ */
/*  Sheet access verification                                          */
/* ------------------------------------------------------------------ */

export interface SheetInfo {
	title: string
	strongerTabExists: boolean
}

/**
 * Verify that the authenticated user can access the given spreadsheet.
 * Returns basic metadata including whether the target tab already exists.
 *
 * Throws if the sheet is inaccessible or the API call fails.
 */
export async function verifySheetAccess(
	spreadsheetId: string,
): Promise<SheetInfo> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	const response = await gapi.client.sheets.spreadsheets.get({
		spreadsheetId,
	})
	const sheets = response.result.sheets ?? []
	const strongerTabExists = sheets.some(
		(s) => s.properties.title === TARGET_TAB_NAME,
	)
	return {
		title: response.result.properties.title,
		strongerTabExists,
	}
}

/* ------------------------------------------------------------------ */
/*  Tab creation                                                       */
/* ------------------------------------------------------------------ */

/**
 * Create the "Stronger" tab inside the given spreadsheet.
 * This is a no-op if the tab already exists (callers should check first).
 */
export async function createStrongerTab(
	spreadsheetId: string,
): Promise<void> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	await gapi.client.sheets.spreadsheets.batchUpdate({
		spreadsheetId,
		resource: {
			requests: [{ addSheet: { properties: { title: TARGET_TAB_NAME } } }],
		},
	})
}

/* ------------------------------------------------------------------ */
/*  Spreadsheet creation                                               */
/* ------------------------------------------------------------------ */

/**
 * Create a brand-new Google Spreadsheet with the given title.
 * Returns the new spreadsheet's ID.
 */
export async function createSpreadsheet(title: string): Promise<string> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	const response = await gapi.client.sheets.spreadsheets.create({
		resource: {
			properties: { title },
		},
	})
	return response.result.spreadsheetId
}

/* ------------------------------------------------------------------ */
/*  Combined connect flow                                              */
/* ------------------------------------------------------------------ */

/**
 * High-level helper: verify sheet access and ensure the "Stronger - Exercises" tab
 * exists. Returns the spreadsheet title.
 */
export async function connectToSheet(spreadsheetId: string): Promise<string> {
	const info = await verifySheetAccess(spreadsheetId)
	if (!info.strongerTabExists) {
		await createStrongerTab(spreadsheetId)
	}
	return info.title
}

/* ------------------------------------------------------------------ */
/*  Log tab management                                                 */
/* ------------------------------------------------------------------ */

/**
 * Check if the log tab exists in the spreadsheet.
 */
export async function verifyLogTab(
	spreadsheetId: string,
): Promise<boolean> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	const response = await gapi.client.sheets.spreadsheets.get({
		spreadsheetId,
	})
	const sheets = response.result.sheets ?? []
	return sheets.some(
		(s) => s.properties.title === LOG_TAB_NAME,
	)
}

/**
 * Create the log tab and write the header row.
 */
export async function createLogTab(
	spreadsheetId: string,
): Promise<void> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	await gapi.client.sheets.spreadsheets.batchUpdate({
		spreadsheetId,
		resource: {
			requests: [{ addSheet: { properties: { title: LOG_TAB_NAME } } }],
		},
	})

	// Write log header to row 1
	await gapi.client.sheets.spreadsheets.values.update({
		spreadsheetId,
		range: LOG_HEADER_RANGE,
		valueInputOption: 'RAW',
		resource: { values: [LOG_HEADER] },
	})
}

/* ------------------------------------------------------------------ */
/*  Config zone serialization                                          */
/* ------------------------------------------------------------------ */

/** Convert a LiftConfig to a spreadsheet row (string/number array). */
export function liftConfigToRow(
	config: LiftConfig,
): (string | number)[] {
	return [
		config.id,
		config.name,
		config.topSetWeight,
		config.backoffWeight,
		config.increment,
		config.minimumWeight,
		config.roundingFactor,
		config.barWeight,
		config.gear,
	]
}

/** Check that a number is finite and non-negative. */
function isValidWeight(n: number): boolean {
	return Number.isFinite(n) && n >= 0;
}

/**
 * Parse a spreadsheet row back into a LiftConfig.
 * Returns `null` if the row is missing required fields or contains
 * non-numeric values where numbers are expected.
 */
/** Valid gear type values. */
const VALID_GEAR_TYPES = new Set(['barbell', 'dumbbell', 'band', 'bodyweight', 'other']);

export function rowToLiftConfig(row: string[]): LiftConfig | null {
	// Need at least id (col 0) and name (col 1) plus 5 numeric columns
	if (!row || row.length < 7) return null;

	const id = (row[0] ?? '').trim();
	const name = (row[1] ?? '').trim();
	if (!id || !name) return null;

	const rawTopSet = (row[2] ?? '').trim();
	const rawBackoff = (row[3] ?? '').trim();
	const rawIncrement = (row[4] ?? '').trim();
	const rawMinWeight = (row[5] ?? '').trim();
	const rawRounding = (row[6] ?? '').trim();

	// Reject rows where any numeric field is blank
	if (!rawTopSet || !rawBackoff || !rawIncrement || !rawMinWeight || !rawRounding) {
		return null;
	}

	const topSetWeight = Number(rawTopSet);
	const backoffWeight = Number(rawBackoff);
	const increment = Number(rawIncrement);
	const minimumWeight = Number(rawMinWeight);
	const roundingFactor = Number(rawRounding);

	// Reject rows where any numeric field is NaN, Infinity, or negative
	if (
		!isValidWeight(topSetWeight) ||
		!isValidWeight(backoffWeight) ||
		!isValidWeight(increment) ||
		!isValidWeight(minimumWeight) ||
		!isValidWeight(roundingFactor)
	) {
		return null;
	}

	// barWeight (col 7) — default to 0 if absent or blank (backward compat)
	const rawBarWeight = (row[7] ?? '').trim();
	const barWeight = rawBarWeight ? Number(rawBarWeight) : 0;
	if (!isValidWeight(barWeight)) return null;

	// gear (col 8) — default to 'other' if absent or unrecognized
	const rawGear = (row[8] ?? '').trim().toLowerCase();
	const gear = VALID_GEAR_TYPES.has(rawGear) ? rawGear as LiftConfig['gear'] : 'other';

	return { id, name, topSetWeight, backoffWeight, increment, minimumWeight, roundingFactor, barWeight, gear };
}

/* ------------------------------------------------------------------ */
/*  Config zone read/write                                             */
/* ------------------------------------------------------------------ */

/**
 * Read the config zone and return LiftConfig values.
 * Returns `null` if the config zone is empty or contains no valid rows
 * (first connection, or all rows are invalid).
 */
export async function readConfigZone(
	spreadsheetId: string,
): Promise<LiftConfig[] | null> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	const response = await gapi.client.sheets.spreadsheets.values.get({
		spreadsheetId,
		range: CONFIG_RANGE,
	})

	const rows = response.result.values
	if (!rows || rows.length <= 1) {
		// Empty or header-only → first connection
		return null
	}

	// Skip header row, parse data rows, filter out invalid entries
	const configs = rows.slice(1)
		.map(rowToLiftConfig)
		.filter((config): config is LiftConfig => config !== null);
	return configs.length > 0 ? configs : null;
}

/**
 * Write the config header + default lift config values to the config zone.
 * Used on first connection when the tab is empty.
 */
export async function writeDefaultConfig(
	spreadsheetId: string,
	defaults: LiftConfig[],
): Promise<void> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	// Build config zone: header + one row per lift
	const configRows: (string | number)[][] = [
		CONFIG_HEADER,
		...defaults.map(liftConfigToRow),
	]

	// Write config zone
	await gapi.client.sheets.spreadsheets.values.update({
		spreadsheetId,
		range: CONFIG_RANGE,
		valueInputOption: 'RAW',
		resource: { values: configRows },
	})
}

/**
 * Write updated lift config values back to the config zone.
 * Clears existing data (below header) first, then writes all rows.
 * Used by the progression review to persist weight changes and by
 * the exercise editor to add/update exercises.
 */
export async function writeConfigValues(
	spreadsheetId: string,
	configs: LiftConfig[],
): Promise<void> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	const rows = configs.map(liftConfigToRow)
	const allRows: (string | number)[][] = [
		CONFIG_HEADER,
		...rows,
	]

	// Clear existing data then write fresh (handles row count changes)
	await gapi.client.sheets.spreadsheets.values.clear({
		spreadsheetId,
		range: CONFIG_RANGE,
	})

	await gapi.client.sheets.spreadsheets.values.update({
		spreadsheetId,
		range: CONFIG_RANGE,
		valueInputOption: 'RAW',
		resource: { values: allRows },
	})
}

/* ------------------------------------------------------------------ */
/*  Log zone serialization                                             */
/* ------------------------------------------------------------------ */

export interface LogContext {
	date: string
	startTime: string
	endTime: string
	workoutId: string
}

/** Build a single log row for one set (strength). */
export function buildLogRow(
	ctx: LogContext,
	exerciseName: string,
	liftId: string,
	setNumber: number,
	setType: string,
	planned: ComputedSet,
	result: SetResult,
): (string | number | boolean)[] {
	return [
		ctx.date,
		ctx.startTime,
		ctx.endTime,
		ctx.workoutId,
		exerciseName,
		liftId,
		setNumber,
		setType,
		planned.weight,
		planned.maxReps,
		result.actualWeight,
		result.actualReps,
		result.completed ? 'TRUE' : 'FALSE',
		'strength',
		'', '', '', '',
	]
}

export interface CardioLogData {
	duration?: number
	distance?: number
	elevation?: number
	weight?: number
}

/** Build a single log row for a cardio workout. */
export function buildCardioLogRow(
	ctx: LogContext,
	workoutName: string,
	data: CardioLogData,
): (string | number | boolean)[] {
	return [
		ctx.date,
		ctx.startTime,
		ctx.endTime,
		ctx.workoutId,
		workoutName,
		'',
		1,
		'cardio',
		0, 0, 0, 0,
		'TRUE',
		'cardio',
		data.duration ?? '',
		data.distance ?? '',
		data.elevation ?? '',
		data.weight ?? '',
	]
}

/* ------------------------------------------------------------------ */
/*  Log zone append                                                    */
/* ------------------------------------------------------------------ */

/**
 * Append set-level log rows to the log tab (row 2+).
 * Rows are appended below all existing data.
 */
export async function appendLogRows(
	spreadsheetId: string,
	rows: (string | number | boolean)[][],
): Promise<void> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	await gapi.client.sheets.spreadsheets.values.append({
		spreadsheetId,
		range: LOG_APPEND_RANGE,
		valueInputOption: 'RAW',
		insertDataOption: 'INSERT_ROWS',
		resource: { values: rows },
	})
}

/* ------------------------------------------------------------------ */
/*  Workout Defs tab – constants                                       */
/* ------------------------------------------------------------------ */

/** A1 range for the workout defs tab (open-ended rows). */
const WORKOUT_DEFS_RANGE = `'${WORKOUT_DEFS_TAB_NAME}'!A:N`

const WORKOUT_DEFS_HEADER: string[] = [
	'workoutId',
	'workoutName',
	'exerciseOrder',
	'exerciseRole',
	'liftId',
	'setType',
	'percentage',
	'weightBasis',
	'minReps',
	'maxReps',
	'amrap',
	'comment',
	'category',
	'favorite',
]

/* ------------------------------------------------------------------ */
/*  Workout Defs tab – serialization                                   */
/* ------------------------------------------------------------------ */

/**
 * Encode a {@link WeightBasis} discriminated union into a single string
 * suitable for a spreadsheet cell.
 *
 * - `{ kind: 'topSet' }`                      → `"topSet"`
 * - `{ kind: 'backoff' }`                     → `"backoff"`
 * - `{ kind: 'crossReference', liftId: 'x' }` → `"crossReference:x"`
 * - `{ kind: 'fixed', weight: 45 }`           → `"fixed:45"`
 */
export function encodeWeightBasis(wb: WeightBasis): string {
	switch (wb.kind) {
		case 'topSet':
			return 'topSet'
		case 'backoff':
			return 'backoff'
		case 'barWeight':
			return 'barWeight'
		case 'crossReference':
			return `crossReference:${wb.liftId}`
		case 'fixed':
			return `fixed:${wb.weight}`
	}
}

/**
 * Decode a weight-basis string back into a {@link WeightBasis}.
 * Returns `null` for unrecognised formats.
 */
export function decodeWeightBasis(raw: string): WeightBasis | null {
	const s = raw.trim()
	if (s === 'topSet') return { kind: 'topSet' }
	if (s === 'backoff') return { kind: 'backoff' }
	if (s === 'barWeight') return { kind: 'barWeight' }
	if (s.startsWith('crossReference:')) {
		const liftId = s.slice('crossReference:'.length).trim()
		return liftId ? { kind: 'crossReference', liftId } : null
	}
	if (s.startsWith('fixed:')) {
		const n = Number(s.slice('fixed:'.length).trim())
		return Number.isFinite(n) && n >= 0 ? { kind: 'fixed', weight: n } : null
	}
	return null
}

/** Valid exercise roles for validation. */
const VALID_ROLES = new Set<ExerciseRole>(['primary', 'secondary', 'assistance'])

/**
 * Build the flat spreadsheet rows from a {@link WorkoutDefinition} array.
 * Each set becomes one row.
 */
export function workoutDefsToRows(
	defs: WorkoutDefinition[],
): (string | number)[][] {
	const rows: (string | number)[][] = []
	for (const def of defs) {
		const category = def.category ?? 'strength'
		if (def.templates.length === 0) {
			// Cardio or other template-less activities: emit a single marker row
			rows.push([
				def.id,
				def.name,
				'',  // exerciseOrder
				'',  // exerciseRole
				'',  // liftId
				'',  // setType
				'',  // percentage
				'',  // weightBasis
				'',  // minReps
				'',  // maxReps
				'',  // amrap
				'',  // comment
				category,
				def.favorite ? 'TRUE' : 'FALSE',
			])
		} else {
			for (let ei = 0; ei < def.templates.length; ei++) {
				const tpl = def.templates[ei]
				const exerciseOrder = ei + 1
				for (const set of tpl.sets) {
					rows.push([
						def.id,
						def.name,
						exerciseOrder,
						tpl.role,
						tpl.liftId,
						set.setType,
						set.percentage,
						encodeWeightBasis(set.weightBasis),
						set.minReps,
						set.maxReps,
						set.amrap ? 'TRUE' : 'FALSE',
						set.comment ?? '',
						category,
						def.favorite ? 'TRUE' : 'FALSE',
					])
				}
			}
		}
	}
	return rows
}

/**
 * Parse an exercise role string, defaulting to 'assistance' for unrecognized values.
 */
function parseExerciseRole(raw: string): ExerciseRole {
	const lower = raw.toLowerCase().trim() as ExerciseRole
	return VALID_ROLES.has(lower) ? lower : 'assistance'
}

/* ------------------------------------------------------------------ */
/*  Workout Defs tab – parsing                                         */
/* ------------------------------------------------------------------ */

interface WorkoutDefRow {
	workoutId: string
	workoutName: string
	exerciseOrder: number
	exerciseRole: string
	liftId: string
	category: ActivityType
	favorite: boolean
	set: SetTemplate
}

/** A marker row for a template-less (e.g. cardio) activity. */
interface WorkoutDefCardioRow {
	workoutId: string
	workoutName: string
	category: ActivityType
	favorite: boolean
	cardio: true
}

type ParsedDefRow = WorkoutDefRow | WorkoutDefCardioRow

/** Type guard: is this a cardio marker row (no exercise/set data)? */
function isCardioMarkerRow(row: ParsedDefRow): row is WorkoutDefCardioRow {
	return 'cardio' in row
}

/**
 * Parse a single spreadsheet row into a {@link ParsedDefRow}.
 * Returns `null` for invalid or incomplete rows.
 *
 * Supports two flavours:
 * 1. **Strength row** – all 12 original columns present (category in col 13 optional, defaults to 'strength').
 * 2. **Cardio marker row** – workoutId + workoutName present, exerciseOrder blank, category = 'cardio'.
 */
export function parseWorkoutDefRow(row: string[]): ParsedDefRow | null {
	if (!row || row.length < 2) return null

	const workoutId = (row[0] ?? '').trim()
	const workoutName = (row[1] ?? '').trim()
	if (!workoutId || !workoutName) return null

	// Detect category from column 13 (index 12) — default to 'strength'
	const rawCategory = (row[12] ?? '').trim().toLowerCase()
	const category: ActivityType = rawCategory === 'cardio' ? 'cardio' : 'strength'

	// Detect favorite from column 14 (index 13) — default to false
	const favorite = (row[13] ?? '').trim().toUpperCase() === 'TRUE'

	// If the exerciseOrder column is empty, this is a cardio marker row
	const rawOrder = (row[2] ?? '').trim()
	if (!rawOrder) {
		// Only allow cardio activities to have no exercise data
		if (category !== 'cardio') return null
		return { workoutId, workoutName, category, favorite, cardio: true }
	}

	// Full strength row — validate all fields
	if (row.length < 11) return null

	const exerciseRole = (row[3] ?? '').trim()
	const liftId = (row[4] ?? '').trim()
	const rawSetType = (row[5] ?? '').trim()
	const rawPct = (row[6] ?? '').trim()
	const rawBasis = (row[7] ?? '').trim()
	const rawMin = (row[8] ?? '').trim()
	const rawMax = (row[9] ?? '').trim()
	const rawAmrap = (row[10] ?? '').trim().toUpperCase()
	const comment = (row[11] ?? '').trim()

	if (!exerciseRole || !liftId) return null
	if (!rawSetType || !rawPct || !rawBasis || !rawMin || !rawMax) return null

	const exerciseOrder = Number(rawOrder)
	if (!Number.isFinite(exerciseOrder) || exerciseOrder < 1) return null

	const setType = rawSetType as 'warmup' | 'work' | 'backoff' | 'joker'
	if (setType !== 'warmup' && setType !== 'work' && setType !== 'backoff' && setType !== 'joker') return null

	const percentage = Number(rawPct)
	if (!Number.isFinite(percentage) || percentage < 0) return null

	const weightBasis = decodeWeightBasis(rawBasis)
	if (!weightBasis) return null

	const minReps = Number(rawMin)
	const maxReps = Number(rawMax)
	if (!Number.isFinite(minReps) || minReps < 0) return null
	if (!Number.isFinite(maxReps) || maxReps < minReps) return null

	const amrap = rawAmrap === 'TRUE'

	const set: SetTemplate = {
		setType,
		percentage,
		weightBasis,
		minReps,
		maxReps,
		amrap,
		...(comment ? { comment } : {}),
	}

	return { workoutId, workoutName, exerciseOrder, exerciseRole, liftId, category, favorite, set }
}

/**
 * Group parsed rows into {@link WorkoutDefinition} array.
 * Rows are grouped by `workoutId`, exercises by `exerciseOrder`.
 * Exercise display names are derived from exerciseRole + liftId
 * (caller should map lift names afterward using configs if desired).
 */
export function rowsToWorkoutDefs(
	rows: ParsedDefRow[],
	liftNames?: ReadonlyMap<string, string>,
): WorkoutDefinition[] {
	// Group by workoutId, preserving row order for stable workout ordering
	const workoutOrder: string[] = []
	const workoutMap = new Map<string, { name: string; category: ActivityType; favorite: boolean; rows: WorkoutDefRow[] }>()
	for (const r of rows) {
		if (!workoutMap.has(r.workoutId)) {
			workoutOrder.push(r.workoutId)
			workoutMap.set(r.workoutId, { name: r.workoutName, category: r.category, favorite: r.favorite, rows: [] })
		}
		if (!isCardioMarkerRow(r)) {
			workoutMap.get(r.workoutId)!.rows.push(r)
		}
	}

	const defs: WorkoutDefinition[] = []
	for (const wid of workoutOrder) {
		const entry = workoutMap.get(wid)!

		// Cardio entries with no set rows → template-less definition
		if (entry.rows.length === 0) {
			defs.push({ id: wid, name: entry.name, category: entry.category, favorite: entry.favorite, templates: [] })
			continue
		}

		// Group by exerciseOrder within this workout
		const exerciseOrderSet: number[] = []
		const exerciseMap = new Map<number, WorkoutDefRow[]>()
		for (const r of entry.rows) {
			if (!exerciseMap.has(r.exerciseOrder)) {
				exerciseOrderSet.push(r.exerciseOrder)
				exerciseMap.set(r.exerciseOrder, [])
			}
			exerciseMap.get(r.exerciseOrder)!.push(r)
		}

		// Sort exercises by exerciseOrder
		exerciseOrderSet.sort((a, b) => a - b)

		const templates: ExerciseTemplate[] = []
		for (const eo of exerciseOrderSet) {
			const exRows = exerciseMap.get(eo)!
			const first = exRows[0]
			// Use lift name as the display name (role is a separate field)
			const name = liftNames?.get(first.liftId) ?? first.liftId
			const role = parseExerciseRole(first.exerciseRole)
			templates.push({
				liftId: first.liftId,
				name,
				role,
				sets: exRows.map((r) => r.set),
			})
		}

		defs.push({ id: wid, name: entry.name, category: entry.category, favorite: entry.favorite, templates })
	}

	return defs
}

/* ------------------------------------------------------------------ */
/*  Workout Defs tab – read/write                                      */
/* ------------------------------------------------------------------ */

/**
 * Check if the "Workout Defs" tab exists in the spreadsheet.
 */
export async function verifyWorkoutDefsTab(
	spreadsheetId: string,
): Promise<boolean> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	const response = await gapi.client.sheets.spreadsheets.get({
		spreadsheetId,
	})
	const sheets = response.result.sheets ?? []
	return sheets.some(
		(s) => s.properties.title === WORKOUT_DEFS_TAB_NAME,
	)
}

/**
 * Create the "Workout Defs" tab inside the given spreadsheet.
 */
export async function createWorkoutDefsTab(
	spreadsheetId: string,
): Promise<void> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	await gapi.client.sheets.spreadsheets.batchUpdate({
		spreadsheetId,
		resource: {
			requests: [{ addSheet: { properties: { title: WORKOUT_DEFS_TAB_NAME } } }],
		},
	})
}

/**
 * Read the "Workout Defs" tab and parse rows into WorkoutDefinition[].
 * Returns `null` if the tab is empty or contains no valid rows.
 *
 * @param liftNames - optional map of liftId → display name for generating
 *   exercise display names. If not provided, the liftId is used as-is.
 */
export async function readWorkoutDefs(
	spreadsheetId: string,
	liftNames?: ReadonlyMap<string, string>,
): Promise<WorkoutDefinition[] | null> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	const response = await gapi.client.sheets.spreadsheets.values.get({
		spreadsheetId,
		range: WORKOUT_DEFS_RANGE,
	})

	const allRows = response.result.values
	if (!allRows || allRows.length <= 1) {
		return null
	}

	// Skip header, parse data rows, filter out nulls
	const parsed = allRows.slice(1)
		.map(parseWorkoutDefRow)
		.filter((r): r is ParsedDefRow => r !== null)

	if (parsed.length === 0) return null

	const defs = rowsToWorkoutDefs(parsed, liftNames)
	return defs.length > 0 ? defs : null
}

/**
 * Write the header + default workout definition rows to the "Workout Defs" tab.
 * Used on first connection when the tab is empty.
 */
export async function writeDefaultWorkoutDefs(
	spreadsheetId: string,
	defs: WorkoutDefinition[],
): Promise<void> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	const dataRows = workoutDefsToRows(defs)
	const allRows: (string | number)[][] = [
		WORKOUT_DEFS_HEADER,
		...dataRows,
	]

	await gapi.client.sheets.spreadsheets.values.update({
		spreadsheetId,
		range: WORKOUT_DEFS_RANGE,
		valueInputOption: 'RAW',
		resource: { values: allRows },
	})
}

/**
 * Write the full set of workout definitions to the "Workout Defs" tab.
 * Clears existing data first, then writes header + all rows.
 */
export async function writeWorkoutDefs(
	spreadsheetId: string,
	defs: WorkoutDefinition[],
): Promise<void> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	const dataRows = workoutDefsToRows(defs)
	const allRows: (string | number)[][] = [
		WORKOUT_DEFS_HEADER,
		...dataRows,
	]

	// Clear existing data then write fresh (handles row count changes)
	await gapi.client.sheets.spreadsheets.values.clear({
		spreadsheetId,
		range: WORKOUT_DEFS_RANGE,
	})

	await gapi.client.sheets.spreadsheets.values.update({
		spreadsheetId,
		range: WORKOUT_DEFS_RANGE,
		valueInputOption: 'RAW',
		resource: { values: allRows },
	})
}

/* ------------------------------------------------------------------ */
/*  Log zone – read & parse                                            */
/* ------------------------------------------------------------------ */

/** A parsed log row representing one completed set or cardio entry. */
export interface ParsedLogRow {
	date: string
	startTime: string
	endTime: string
	workoutId: string
	exerciseName: string
	liftId: string
	setNumber: number
	setType: string
	plannedWeight: number
	plannedReps: number
	actualWeight: number
	actualReps: number
	completed: boolean
	category: 'strength' | 'cardio'
	duration?: number
	distance?: number
	elevation?: number
	cardioWeight?: number
}

/**
 * Parse a single raw log row (string array) into a {@link ParsedLogRow}.
 * Returns `null` for incomplete or invalid rows.
 */
export function parseLogRow(row: string[]): ParsedLogRow | null {
	if (!row || row.length < 13) return null

	const date = (row[0] ?? '').trim()
	const startTime = (row[1] ?? '').trim()
	const endTime = (row[2] ?? '').trim()
	const workoutId = (row[3] ?? '').trim()
	const exerciseName = (row[4] ?? '').trim()
	const liftId = (row[5] ?? '').trim()
	const rawSetNumber = (row[6] ?? '').trim()
	const setType = (row[7] ?? '').trim()
	const rawPlannedWeight = (row[8] ?? '').trim()
	const rawPlannedReps = (row[9] ?? '').trim()
	const rawActualWeight = (row[10] ?? '').trim()
	const rawActualReps = (row[11] ?? '').trim()
	const rawCompleted = (row[12] ?? '').trim().toUpperCase()

	// New columns (may be absent in old rows)
	const rawCategory = (row[13] ?? '').trim().toLowerCase()
	const rawDuration = (row[14] ?? '').trim()
	const rawDistance = (row[15] ?? '').trim()
	const rawElevation = (row[16] ?? '').trim()
	const rawCardioWeight = (row[17] ?? '').trim()

	const category: 'strength' | 'cardio' = rawCategory === 'cardio' ? 'cardio' : 'strength'

	if (!date || !startTime || !workoutId || !exerciseName) return null

	// Cardio rows don't need valid set numbers or actual weight/reps
	if (category === 'cardio') {
		const duration = rawDuration ? Number(rawDuration) : undefined
		const distance = rawDistance ? Number(rawDistance) : undefined
		const elevation = rawElevation ? Number(rawElevation) : undefined
		const cardioWeight = rawCardioWeight ? Number(rawCardioWeight) : undefined

		return {
			date,
			startTime,
			endTime,
			workoutId,
			exerciseName,
			liftId,
			setNumber: 1,
			setType: 'cardio',
			plannedWeight: 0,
			plannedReps: 0,
			actualWeight: 0,
			actualReps: 0,
			completed: true,
			category,
			...(duration !== undefined && Number.isFinite(duration) ? { duration } : {}),
			...(distance !== undefined && Number.isFinite(distance) ? { distance } : {}),
			...(elevation !== undefined && Number.isFinite(elevation) ? { elevation } : {}),
			...(cardioWeight !== undefined && Number.isFinite(cardioWeight) ? { cardioWeight } : {}),
		}
	}

	const setNumber = Number(rawSetNumber)
	const plannedWeight = Number(rawPlannedWeight)
	const plannedReps = Number(rawPlannedReps)
	const actualWeight = Number(rawActualWeight)
	const actualReps = Number(rawActualReps)

	if (!Number.isFinite(setNumber) || setNumber < 1) return null
	if (!Number.isFinite(actualWeight) || !Number.isFinite(actualReps)) return null

	return {
		date,
		startTime,
		endTime,
		workoutId,
		exerciseName,
		liftId,
		setNumber,
		setType,
		plannedWeight: Number.isFinite(plannedWeight) ? plannedWeight : 0,
		plannedReps: Number.isFinite(plannedReps) ? plannedReps : 0,
		actualWeight,
		actualReps,
		completed: rawCompleted === 'TRUE',
		category,
	}
}

/**
 * Find the previous workout's set data for each exercise/set position.
 *
 * Scans the parsed log rows to find the most recent session matching
 * `workoutId`, then returns a 2D array indexed by exercise position and
 * set position within that exercise. Returns `null` when no previous
 * session exists.
 *
 * "Most recent session" is identified by the latest `startTime` value
 * among rows with the target `workoutId`.
 */
export function findPreviousWorkoutSets(
	logRows: ParsedLogRow[],
	workoutId: string,
): PreviousSetData[][] | null {
	// Filter to rows matching this workout ID
	const matching = logRows.filter((r) => r.workoutId === workoutId)
	if (matching.length === 0) return null

	// Find the most recent session by startTime (lexicographic sort on ISO strings)
	let latestStart = ''
	for (const row of matching) {
		if (row.startTime > latestStart) {
			latestStart = row.startTime
		}
	}

	const sessionRows = matching.filter((r) => r.startTime === latestStart)
	if (sessionRows.length === 0) return null

	// Group by exercise name, preserving first-seen order
	const exerciseOrder: string[] = []
	const exerciseMap = new Map<string, ParsedLogRow[]>()
	for (const row of sessionRows) {
		if (!exerciseMap.has(row.exerciseName)) {
			exerciseOrder.push(row.exerciseName)
			exerciseMap.set(row.exerciseName, [])
		}
		exerciseMap.get(row.exerciseName)!.push(row)
	}

	// Build 2D array: exercises × sets (sorted by setNumber within each exercise)
	const result: PreviousSetData[][] = []
	for (const name of exerciseOrder) {
		const rows = exerciseMap.get(name)!
		rows.sort((a, b) => a.setNumber - b.setNumber)
		result.push(
			rows.map((r) => ({ weight: r.actualWeight, reps: r.actualReps })),
		)
	}

	return result
}

/**
 * Read the log tab (row 2+) and return parsed log rows.
 * Returns an empty array if there are no log entries yet.
 */
export async function readLogZone(
	spreadsheetId: string,
): Promise<ParsedLogRow[]> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	const response = await gapi.client.sheets.spreadsheets.values.get({
		spreadsheetId,
		range: LOG_READ_RANGE,
	})

	const rawRows = response.result.values
	if (!rawRows || rawRows.length === 0) return []

	return rawRows
		.map(parseLogRow)
		.filter((r): r is ParsedLogRow => r !== null)
}

/* ------------------------------------------------------------------ */
/*  Schedule tab – constants                                           */
/* ------------------------------------------------------------------ */

/** A1 range for the schedule header (row 1). */
const SCHEDULE_HEADER_RANGE = `'${SCHEDULE_TAB_NAME}'!A1:B1`

/** A1 range for reading all schedule data (row 2 onward, generous upper bound). */
const SCHEDULE_READ_RANGE = `'${SCHEDULE_TAB_NAME}'!A2:B10000`

/** A1 range covering the full schedule tab for clearing. */
const SCHEDULE_FULL_RANGE = `'${SCHEDULE_TAB_NAME}'!A1:B10000`

const SCHEDULE_HEADER: string[] = ['date', 'workoutId']

/* ------------------------------------------------------------------ */
/*  Schedule tab – serialization                                       */
/* ------------------------------------------------------------------ */

/**
 * Parse a single raw schedule row (string array) into a {@link ScheduleEntry}.
 * Returns `null` for incomplete or invalid rows.
 */
export function parseScheduleRow(row: string[]): ScheduleEntry | null {
	if (!row || row.length < 2) return null

	const date = (row[0] ?? '').trim()
	const workoutId = (row[1] ?? '').trim()

	if (!date || !workoutId) return null
	// Basic date format validation: YYYY-MM-DD
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null

	return { date, workoutId }
}

/** Convert a {@link ScheduleEntry} to a spreadsheet row. */
export function scheduleEntryToRow(entry: ScheduleEntry): string[] {
	return [entry.date, entry.workoutId]
}

/* ------------------------------------------------------------------ */
/*  Schedule tab – read/write                                          */
/* ------------------------------------------------------------------ */

/**
 * Check if the schedule tab exists in the spreadsheet.
 */
export async function verifyScheduleTab(
	spreadsheetId: string,
): Promise<boolean> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	const response = await gapi.client.sheets.spreadsheets.get({
		spreadsheetId,
	})
	const sheets = response.result.sheets ?? []
	return sheets.some(
		(s) => s.properties.title === SCHEDULE_TAB_NAME,
	)
}

/**
 * Create the schedule tab and write the header row.
 */
export async function createScheduleTab(
	spreadsheetId: string,
): Promise<void> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	await gapi.client.sheets.spreadsheets.batchUpdate({
		spreadsheetId,
		resource: {
			requests: [{ addSheet: { properties: { title: SCHEDULE_TAB_NAME } } }],
		},
	})

	// Write schedule header to row 1
	await gapi.client.sheets.spreadsheets.values.update({
		spreadsheetId,
		range: SCHEDULE_HEADER_RANGE,
		valueInputOption: 'RAW',
		resource: { values: [SCHEDULE_HEADER] },
	})
}

/**
 * Read the schedule tab and return parsed schedule entries.
 * Returns an empty array if there are no entries yet.
 */
export async function readSchedule(
	spreadsheetId: string,
): Promise<ScheduleEntry[]> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	const response = await gapi.client.sheets.spreadsheets.values.get({
		spreadsheetId,
		range: SCHEDULE_READ_RANGE,
	})

	const rawRows = response.result.values
	if (!rawRows || rawRows.length === 0) return []

	return rawRows
		.map(parseScheduleRow)
		.filter((r): r is ScheduleEntry => r !== null)
}

/**
 * Write the full schedule to the sheet (header + all entries).
 * This overwrites all existing schedule data.
 */
export async function writeSchedule(
	spreadsheetId: string,
	entries: ScheduleEntry[],
): Promise<void> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	const rows: string[][] = [
		SCHEDULE_HEADER,
		...entries.map(scheduleEntryToRow),
	]

	// Clear existing data then write fresh
	await gapi.client.sheets.spreadsheets.values.clear({
		spreadsheetId,
		range: SCHEDULE_FULL_RANGE,
	})

	await gapi.client.sheets.spreadsheets.values.update({
		spreadsheetId,
		range: SCHEDULE_FULL_RANGE,
		valueInputOption: 'RAW',
		resource: { values: rows },
	})
}
