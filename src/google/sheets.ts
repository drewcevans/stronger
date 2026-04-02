/**
 * Google Sheets API helpers.
 *
 * Verifies access to a spreadsheet, ensures the "Stronger" tab exists,
 * and provides read/write operations for the config and log zones.
 */

import { TARGET_TAB_NAME, WORKOUT_DEFS_TAB_NAME } from './config.ts'
import type { LiftConfig, ComputedSet, SetResult, SetTemplate, ExerciseTemplate, WeightBasis } from '../model/types.ts'
import type { WorkoutDefinition } from '../data/sample-workouts.ts'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** A1 range for the config zone: header row + up to 20 lift rows. */
const CONFIG_RANGE = `${TARGET_TAB_NAME}!A1:G21`

/** A1 range for the log zone header (row 10). */
const LOG_HEADER_RANGE = `${TARGET_TAB_NAME}!A10:M10`

/** A1 range used for appending log data (row 11 onward). */
const LOG_APPEND_RANGE = `${TARGET_TAB_NAME}!A11:M11`

const CONFIG_HEADER: string[] = [
	'id',
	'name',
	'topSetWeight',
	'backoffWeight',
	'increment',
	'minimumWeight',
	'roundingFactor',
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
/*  Combined connect flow                                              */
/* ------------------------------------------------------------------ */

/**
 * High-level helper: verify sheet access and ensure the "Stronger" tab
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

	return { id, name, topSetWeight, backoffWeight, increment, minimumWeight, roundingFactor };
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
 * Also writes the log header to row 10. Used on first connection when
 * the tab is empty.
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

	// Write config zone (rows 1–8)
	await gapi.client.sheets.spreadsheets.values.update({
		spreadsheetId,
		range: CONFIG_RANGE,
		valueInputOption: 'RAW',
		resource: { values: configRows },
	})

	// Write log header to row 10
	await gapi.client.sheets.spreadsheets.values.update({
		spreadsheetId,
		range: LOG_HEADER_RANGE,
		valueInputOption: 'RAW',
		resource: { values: [LOG_HEADER] },
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

/** Build a single log row for one set. */
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
	]
}

/* ------------------------------------------------------------------ */
/*  Log zone append                                                    */
/* ------------------------------------------------------------------ */

/**
 * Append set-level log rows to the log zone (row 11+).
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

/** A1 range for the workout defs header + data rows (generous upper bound). */
const WORKOUT_DEFS_RANGE = `'${WORKOUT_DEFS_TAB_NAME}'!A1:L500`

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

/** Valid exercise roles within a workout definition. */
type ExerciseRole = 'primary' | 'secondary' | 'assistance'

/**
 * Build the flat spreadsheet rows from a {@link WorkoutDefinition} array.
 * Each set becomes one row.
 */
export function workoutDefsToRows(
	defs: WorkoutDefinition[],
): (string | number)[][] {
	const rows: (string | number)[][] = []
	for (const def of defs) {
		for (let ei = 0; ei < def.templates.length; ei++) {
			const tpl = def.templates[ei]
			const exerciseOrder = ei + 1
			const role = inferExerciseRole(tpl.name)
			for (const set of tpl.sets) {
				rows.push([
					def.id,
					def.name,
					exerciseOrder,
					role,
					tpl.liftId,
					set.setType,
					set.percentage,
					encodeWeightBasis(set.weightBasis),
					set.minReps,
					set.maxReps,
					set.amrap ? 'TRUE' : 'FALSE',
					set.comment ?? '',
				])
			}
		}
	}
	return rows
}

/**
 * Extract an exercise role from a display name like "Primary: Bench Press".
 * Falls back to 'assistance' when the name doesn't start with a recognised prefix.
 */
function inferExerciseRole(name: string): ExerciseRole {
	const lower = name.toLowerCase()
	if (lower.startsWith('primary')) return 'primary'
	if (lower.startsWith('secondary')) return 'secondary'
	return 'assistance'
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
	set: SetTemplate
}

/**
 * Parse a single spreadsheet row into a {@link WorkoutDefRow}.
 * Returns `null` for invalid or incomplete rows.
 */
export function parseWorkoutDefRow(row: string[]): WorkoutDefRow | null {
	if (!row || row.length < 11) return null

	const workoutId = (row[0] ?? '').trim()
	const workoutName = (row[1] ?? '').trim()
	const rawOrder = (row[2] ?? '').trim()
	const exerciseRole = (row[3] ?? '').trim()
	const liftId = (row[4] ?? '').trim()
	const rawSetType = (row[5] ?? '').trim()
	const rawPct = (row[6] ?? '').trim()
	const rawBasis = (row[7] ?? '').trim()
	const rawMin = (row[8] ?? '').trim()
	const rawMax = (row[9] ?? '').trim()
	const rawAmrap = (row[10] ?? '').trim().toUpperCase()
	const comment = (row[11] ?? '').trim()

	if (!workoutId || !workoutName || !rawOrder || !exerciseRole || !liftId) return null
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

	return { workoutId, workoutName, exerciseOrder, exerciseRole, liftId, set }
}

/**
 * Group parsed rows into {@link WorkoutDefinition} array.
 * Rows are grouped by `workoutId`, exercises by `exerciseOrder`.
 * Exercise display names are derived from exerciseRole + liftId
 * (caller should map lift names afterward using configs if desired).
 */
export function rowsToWorkoutDefs(
	rows: WorkoutDefRow[],
	liftNames?: ReadonlyMap<string, string>,
): WorkoutDefinition[] {
	// Group by workoutId, preserving row order for stable workout ordering
	const workoutOrder: string[] = []
	const workoutMap = new Map<string, { name: string; rows: WorkoutDefRow[] }>()
	for (const r of rows) {
		if (!workoutMap.has(r.workoutId)) {
			workoutOrder.push(r.workoutId)
			workoutMap.set(r.workoutId, { name: r.workoutName, rows: [] })
		}
		workoutMap.get(r.workoutId)!.rows.push(r)
	}

	const defs: WorkoutDefinition[] = []
	for (const wid of workoutOrder) {
		const entry = workoutMap.get(wid)!
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
			// Derive display name from role + lift name
			const liftName = liftNames?.get(first.liftId) ?? first.liftId
			const roleLabel = first.exerciseRole.charAt(0).toUpperCase() + first.exerciseRole.slice(1)
			const name = `${roleLabel}: ${liftName}`
			templates.push({
				liftId: first.liftId,
				name,
				sets: exRows.map((r) => r.set),
			})
		}

		defs.push({ id: wid, name: entry.name, templates })
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
		.filter((r): r is WorkoutDefRow => r !== null)

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
