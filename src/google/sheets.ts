/**
 * Google Sheets API helpers.
 *
 * Verifies access to a spreadsheet, ensures the "Stronger" tab exists,
 * and provides read/write operations for the config and log zones.
 */

import { TARGET_TAB_NAME } from './config.ts'
import type { LiftConfig, ComputedSet, SetResult } from '../model/types.ts'

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
