/**
 * Google Sheets helpers — data access via Apps Script fetch API.
 * All tab verification, creation, and gapi calls have been removed.
 * The spreadsheet tabs are assumed to already exist.
 */

import { TARGET_TAB_NAME, WORKOUT_DEFS_TAB_NAME, LOG_TAB_NAME, SCHEDULE_TAB_NAME, CARDIO_TAB_NAME } from './config.ts'
import { readSheet, appendRow, updateRow, writeSheet, upsertRow } from './api.ts'
import type { LiftConfig, ComputedSet, SetResult, SetTemplate, ExerciseTemplate, ExerciseRole, WeightBasis, PreviousSetData, ScheduleEntry, DayFlags, CardioActivity } from '../model/types.ts'
import { FLAG_SENTINEL } from '../model/types.ts'
import type { WorkoutDefinition } from '../data/sample-workouts.ts'

/* ------------------------------------------------------------------ */
/*  Header definitions (used for row ↔ object conversion)             */
/* ------------------------------------------------------------------ */

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
]

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
	'favorite',
]

const SCHEDULE_HEADER: string[] = ['date', 'workoutId', 'home', 'travel', 'event', 'blocked', 'calendarEventId', 'strongerId']

const CARDIO_HEADER: string[] = ['id', 'name']

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

/** Valid gear type values. */
const VALID_GEAR_TYPES = new Set(['barbell', 'dumbbell', 'band', 'bodyweight', 'other']);

/**
 * Parse a spreadsheet row back into a LiftConfig.
 * Returns `null` if the row is missing required fields or contains
 * non-numeric values where numbers are expected.
 */
export function rowToLiftConfig(row: string[]): LiftConfig | null {
	if (!row || row.length < 7) return null;

	const id = String(row[0] ?? '').trim();
	const name = String(row[1] ?? '').trim();
	if (!id || !name) return null;

	const rawTopSet = String(row[2] ?? '').trim();
	const rawBackoff = String(row[3] ?? '').trim();
	const rawIncrement = String(row[4] ?? '').trim();
	const rawMinWeight = String(row[5] ?? '').trim();
	const rawRounding = String(row[6] ?? '').trim();

	if (!rawTopSet || !rawBackoff || !rawIncrement || !rawMinWeight || !rawRounding) {
		return null;
	}

	const topSetWeight = Number(rawTopSet);
	const backoffWeight = Number(rawBackoff);
	const increment = Number(rawIncrement);
	const minimumWeight = Number(rawMinWeight);
	const roundingFactor = Number(rawRounding);

	if (
		!isValidWeight(topSetWeight) ||
		!isValidWeight(backoffWeight) ||
		!isValidWeight(increment) ||
		!isValidWeight(minimumWeight) ||
		!isValidWeight(roundingFactor)
	) {
		return null;
	}

	const rawBarWeight = String(row[7] ?? '').trim();
	const barWeight = rawBarWeight ? Number(rawBarWeight) : 0;
	if (!isValidWeight(barWeight)) return null;

	const rawGear = String(row[8] ?? '').trim().toLowerCase();
	const gear = VALID_GEAR_TYPES.has(rawGear) ? rawGear as LiftConfig['gear'] : 'other';

	return { id, name, topSetWeight, backoffWeight, increment, minimumWeight, roundingFactor, barWeight, gear };
}

/* ------------------------------------------------------------------ */
/*  Config zone read/write                                             */
/* ------------------------------------------------------------------ */

export async function readConfigZone(): Promise<LiftConfig[] | null> {
	const rows = await readSheet<Record<string, string>>(TARGET_TAB_NAME)
	if (!rows || rows.length === 0) return null

	const configs = rows
		.map((row) => CONFIG_HEADER.map((k) => row[k] ?? ''))
		.map(rowToLiftConfig)
		.filter((c): c is LiftConfig => c !== null)

	return configs.length > 0 ? configs : null
}

export async function writeConfigValues(configs: LiftConfig[]): Promise<void> {
	for (const config of configs) {
		await upsertRow(TARGET_TAB_NAME, { id: config.id }, {
			id: config.id,
			name: config.name,
			topSetWeight: config.topSetWeight,
			backoffWeight: config.backoffWeight,
			increment: config.increment,
			minimumWeight: config.minimumWeight,
			roundingFactor: config.roundingFactor,
			barWeight: config.barWeight,
			gear: config.gear,
		})
	}
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
	]
}

/* ------------------------------------------------------------------ */
/*  Log zone – parsed row type                                         */
/* ------------------------------------------------------------------ */

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
}

export function parseLogRow(row: string[]): ParsedLogRow | null {
	if (!row || row.length < 13) return null

	const date = String(row[0] ?? '').trim()
	const startTime = String(row[1] ?? '').trim()
	const endTime = String(row[2] ?? '').trim()
	const workoutId = String(row[3] ?? '').trim()
	const exerciseName = String(row[4] ?? '').trim()
	const liftId = String(row[5] ?? '').trim()
	const rawSetNumber = String(row[6] ?? '').trim()
	const setType = String(row[7] ?? '').trim()
	const rawPlannedWeight = String(row[8] ?? '').trim()
	const rawPlannedReps = String(row[9] ?? '').trim()
	const rawActualWeight = String(row[10] ?? '').trim()
	const rawActualReps = String(row[11] ?? '').trim()
	const rawCompleted = String(row[12] ?? '').trim().toUpperCase()

	if (!date || !startTime || !workoutId || !exerciseName) return null

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
	}
}

export function findPreviousWorkoutSets(
	logRows: ParsedLogRow[],
	workoutId: string,
): PreviousSetData[][] | null {
	const matching = logRows.filter((r) => r.workoutId === workoutId)
	if (matching.length === 0) return null

	let latestStart = ''
	for (const row of matching) {
		if (row.startTime > latestStart) latestStart = row.startTime
	}

	const sessionRows = matching.filter((r) => r.startTime === latestStart)
	if (sessionRows.length === 0) return null

	const exerciseOrder: string[] = []
	const exerciseMap = new Map<string, ParsedLogRow[]>()
	for (const row of sessionRows) {
		if (!exerciseMap.has(row.exerciseName)) {
			exerciseOrder.push(row.exerciseName)
			exerciseMap.set(row.exerciseName, [])
		}
		exerciseMap.get(row.exerciseName)!.push(row)
	}

	const result: PreviousSetData[][] = []
	for (const name of exerciseOrder) {
		const rows = exerciseMap.get(name)!
		rows.sort((a, b) => a.setNumber - b.setNumber)
		result.push(rows.map((r) => ({ weight: r.actualWeight, reps: r.actualReps })))
	}

	return result
}

/* ------------------------------------------------------------------ */
/*  Log zone – read/write                                              */
/* ------------------------------------------------------------------ */

export async function readLogZone(): Promise<ParsedLogRow[]> {
	const rows = await readSheet<Record<string, string>>(LOG_TAB_NAME)
	if (!rows || rows.length === 0) return []

	return rows
		.map((row) => LOG_HEADER.map((k) => row[k] ?? ''))
		.map(parseLogRow)
		.filter((r): r is ParsedLogRow => r !== null)
}

export async function appendLogRows(rows: (string | number | boolean)[][]): Promise<void> {
	for (const row of rows) {
		const obj: Record<string, unknown> = {}
		for (let i = 0; i < LOG_HEADER.length; i++) {
			obj[LOG_HEADER[i]] = row[i]
		}
		await appendRow(LOG_TAB_NAME, obj)
	}
}

export async function updateLogRows(
	sessionDate: string,
	sessionWorkoutId: string,
	sessionStartTime: string,
	updatedRows: ParsedLogRow[],
): Promise<void> {
	const allRows = await readSheet<Record<string, string>>(LOG_TAB_NAME)
	if (!allRows || allRows.length === 0) return

	const updateMap = new Map<string, ParsedLogRow>()
	for (const row of updatedRows) {
		updateMap.set(`${row.exerciseName}:${row.setNumber}`, row)
	}

	for (let i = 0; i < allRows.length; i++) {
		const raw = allRows[i]
		if ((raw['date'] ?? '').trim() !== sessionDate) continue
		if ((raw['startTime'] ?? '').trim() !== sessionStartTime) continue
		if ((raw['workoutId'] ?? '').trim() !== sessionWorkoutId) continue

		const key = `${(raw['exerciseName'] ?? '').trim()}:${(raw['setNumber'] ?? '').trim()}`
		const updated = updateMap.get(key)
		if (!updated) continue

		await updateRow(LOG_TAB_NAME, i, [
			updated.date,
			updated.startTime,
			updated.endTime,
			updated.workoutId,
			updated.exerciseName,
			updated.liftId,
			updated.setNumber,
			updated.setType,
			updated.plannedWeight,
			updated.plannedReps,
			updated.actualWeight,
			updated.actualReps,
			updated.completed ? 'TRUE' : 'FALSE',
		])
	}
}

export async function deleteLogSession(
	_sessionDate: string,
	_sessionWorkoutId: string,
	_sessionStartTime: string,
): Promise<void> {
	throw new Error('deleteLogSession is not yet implemented for the Apps Script API')
}

/* ------------------------------------------------------------------ */
/*  Workout Defs – serialization                                       */
/* ------------------------------------------------------------------ */

export function encodeWeightBasis(wb: WeightBasis): string {
	switch (wb.kind) {
		case 'topSet': return 'topSet'
		case 'backoff': return 'backoff'
		case 'barWeight': return 'barWeight'
		case 'crossReference': return `crossReference:${wb.liftId}`
		case 'fixed': return `fixed:${wb.weight}`
	}
}

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

const VALID_ROLES = new Set<ExerciseRole>(['primary', 'secondary', 'assistance'])

export function workoutDefsToRows(defs: WorkoutDefinition[]): (string | number)[][] {
	const rows: (string | number)[][] = []
	for (const def of defs) {
		if (def.templates.length === 0) continue
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
					def.favorite ? 'TRUE' : 'FALSE',
				])
			}
		}
	}
	return rows
}

function parseExerciseRole(raw: string): ExerciseRole {
	const lower = raw.toLowerCase().trim() as ExerciseRole
	return VALID_ROLES.has(lower) ? lower : 'assistance'
}

interface WorkoutDefRow {
	workoutId: string
	workoutName: string
	exerciseOrder: number
	exerciseRole: string
	liftId: string
	favorite: boolean
	set: SetTemplate
}

export function parseWorkoutDefRow(row: string[]): WorkoutDefRow | null {
	if (!row || row.length < 2) return null

	const workoutId = String(row[0] ?? '').trim()
	const workoutName = String(row[1] ?? '').trim()
	if (!workoutId || !workoutName) return null

	const favorite = String(row[12] ?? '').trim().toUpperCase() === 'TRUE'
	const rawOrder = String(row[2] ?? '').trim()
	if (!rawOrder) return null
	if (row.length < 11) return null

	const exerciseRole = String(row[3] ?? '').trim()
	const liftId = String(row[4] ?? '').trim()
	const rawSetType = String(row[5] ?? '').trim()
	const rawPct = String(row[6] ?? '').trim()
	const rawBasis = String(row[7] ?? '').trim()
	const rawMin = String(row[8] ?? '').trim()
	const rawMax = String(row[9] ?? '').trim()
	const rawAmrap = String(row[10] ?? '').trim().toUpperCase()
	const comment = String(row[11] ?? '').trim()

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

	return { workoutId, workoutName, exerciseOrder, exerciseRole, liftId, favorite, set }
}

export function rowsToWorkoutDefs(
	rows: WorkoutDefRow[],
	liftNames?: ReadonlyMap<string, string>,
): WorkoutDefinition[] {
	const workoutOrder: string[] = []
	const workoutMap = new Map<string, { name: string; favorite: boolean; rows: WorkoutDefRow[] }>()
	for (const r of rows) {
		if (!workoutMap.has(r.workoutId)) {
			workoutOrder.push(r.workoutId)
			workoutMap.set(r.workoutId, { name: r.workoutName, favorite: r.favorite, rows: [] })
		}
		workoutMap.get(r.workoutId)!.rows.push(r)
	}

	const defs: WorkoutDefinition[] = []
	for (const wid of workoutOrder) {
		const entry = workoutMap.get(wid)!
		const exerciseOrderSet: number[] = []
		const exerciseMap = new Map<number, WorkoutDefRow[]>()
		for (const r of entry.rows) {
			if (!exerciseMap.has(r.exerciseOrder)) {
				exerciseOrderSet.push(r.exerciseOrder)
				exerciseMap.set(r.exerciseOrder, [])
			}
			exerciseMap.get(r.exerciseOrder)!.push(r)
		}
		exerciseOrderSet.sort((a, b) => a - b)

		const templates: ExerciseTemplate[] = []
		for (const eo of exerciseOrderSet) {
			const exRows = exerciseMap.get(eo)!
			const first = exRows[0]
			const name = liftNames?.get(first.liftId) ?? first.liftId
			const role = parseExerciseRole(first.exerciseRole)
			templates.push({ liftId: first.liftId, name, role, sets: exRows.map((r) => r.set) })
		}

		defs.push({ id: wid, name: entry.name, favorite: entry.favorite, templates })
	}
	return defs
}

/* ------------------------------------------------------------------ */
/*  Workout Defs – read/write                                          */
/* ------------------------------------------------------------------ */

export async function readWorkoutDefs(
	liftNames?: ReadonlyMap<string, string>,
): Promise<WorkoutDefinition[] | null> {
	const rows = await readSheet<Record<string, string>>(WORKOUT_DEFS_TAB_NAME)
	if (!rows || rows.length === 0) return null

	const parsed = rows
		.map((row) => WORKOUT_DEFS_HEADER.map((k) => row[k] ?? ''))
		.map(parseWorkoutDefRow)
		.filter((r): r is WorkoutDefRow => r !== null)

	if (parsed.length === 0) return null
	const defs = rowsToWorkoutDefs(parsed, liftNames)
	return defs.length > 0 ? defs : null
}

export async function writeWorkoutDefs(defs: WorkoutDefinition[]): Promise<void> {
	const rows = workoutDefsToRows(defs)
	for (const row of rows) {
		const obj: Record<string, unknown> = {}
		for (let i = 0; i < WORKOUT_DEFS_HEADER.length; i++) {
			obj[WORKOUT_DEFS_HEADER[i]] = row[i]
		}
		await appendRow(WORKOUT_DEFS_TAB_NAME, obj)
	}
}

/* ------------------------------------------------------------------ */
/*  Schedule – serialization                                           */
/* ------------------------------------------------------------------ */

export function parseScheduleRow(row: string[]): ScheduleEntry | null {
	if (!row || row.length < 1) return null

	const date = String(row[0] ?? '').trim()
	const workoutId = String(row[1] ?? '').trim()

	if (!date) return null
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null

	const flags: DayFlags = {
		home: String(row[2] ?? '').trim().toUpperCase() === 'TRUE',
		travel: String(row[3] ?? '').trim().toUpperCase() === 'TRUE',
		event: String(row[4] ?? '').trim().toUpperCase() === 'TRUE',
		blocked: String(row[5] ?? '').trim().toUpperCase() === 'TRUE',
	}

	const hasFlags = flags.home || flags.travel || flags.event || flags.blocked
	const calendarEventId = String(row[7] ?? '').trim() || undefined
	const strongerId = String(row[8] ?? '').trim() || undefined

	if (!workoutId && !hasFlags && !calendarEventId && !strongerId) return null

	return {
		date,
		workoutId,
		...(hasFlags ? { flags } : {}),
		...(calendarEventId ? { calendarEventId } : {}),
		...(strongerId ? { strongerId } : {}),
	}
}

export function scheduleEntryToRow(entry: ScheduleEntry): string[] {
	const f = entry.flags
	return [
		entry.date,
		entry.workoutId,
		f?.home ? 'TRUE' : '',
		f?.travel ? 'TRUE' : '',
		f?.event ? 'TRUE' : '',
		f?.blocked ? 'TRUE' : '',
		entry.calendarEventId ?? '',
		entry.strongerId ?? '',
	]
}

/* ------------------------------------------------------------------ */
/*  Schedule – read/write                                              */
/* ------------------------------------------------------------------ */

/** Normalize any date value from Google Sheets to YYYY-MM-DD. */
function normalizeSheetDate(d: string): string {
	if (!d) return '';
	// Google Sheets date serial number (e.g. "46000")
	if (/^\d+$/.test(d.trim())) {
		const date = new Date((Number(d.trim()) - 25569) * 86400 * 1000);
		return date.toISOString().split('T')[0];
	}
	// ISO datetime string
	if (d.includes('T')) return d.split('T')[0];
	return d.trim().slice(0, 10);
}

export async function readSchedule(): Promise<ScheduleEntry[]> {
	const rows = await readSheet<Record<string, string>>(SCHEDULE_TAB_NAME)
	if (!rows || rows.length === 0) return []

	return rows
		.map((row) => {
			const normalized: Record<string, string> = { ...row, date: normalizeSheetDate(row['date'] ?? '') };
			return SCHEDULE_HEADER.map((k) => normalized[k] ?? '');
		})
		.map(parseScheduleRow)
		.filter((r): r is ScheduleEntry => r !== null && r.workoutId !== FLAG_SENTINEL)
}

export async function writeSchedule(entries: ScheduleEntry[]): Promise<void> {
	const rows = entries.map((entry) => {
		const row = scheduleEntryToRow(entry)
		const obj: Record<string, unknown> = {}
		for (let i = 0; i < SCHEDULE_HEADER.length; i++) {
			obj[SCHEDULE_HEADER[i]] = row[i]
		}
		return obj
	})
	await writeSheet(SCHEDULE_TAB_NAME, rows)
}

/* ------------------------------------------------------------------ */
/*  Cardio – serialization                                             */
/* ------------------------------------------------------------------ */

export function cardioActivityToRow(activity: CardioActivity): string[] {
	return [activity.id, activity.name]
}

export function parseCardioRow(row: string[]): CardioActivity | null {
	if (!row || row.length < 2) return null
	const id = String(row[0] ?? '').trim()
	const name = String(row[1] ?? '').trim()
	if (!id || !name) return null
	return { id, name }
}

/* ------------------------------------------------------------------ */
/*  Cardio – read/write                                                */
/* ------------------------------------------------------------------ */

export async function readCardioActivities(): Promise<CardioActivity[] | null> {
	const rows = await readSheet<Record<string, string>>(CARDIO_TAB_NAME)
	if (!rows || rows.length === 0) return null

	const parsed = rows
		.map((row) => CARDIO_HEADER.map((k) => row[k] ?? ''))
		.map(parseCardioRow)
		.filter((r): r is CardioActivity => r !== null)

	return parsed.length > 0 ? parsed : null
}

export async function writeCardioActivities(activities: CardioActivity[]): Promise<void> {
	for (const activity of activities) {
		const row = cardioActivityToRow(activity)
		const obj: Record<string, unknown> = {}
		for (let i = 0; i < CARDIO_HEADER.length; i++) {
			obj[CARDIO_HEADER[i]] = row[i]
		}
		await appendRow(CARDIO_TAB_NAME, obj)
	}
}

/* ------------------------------------------------------------------ */
/*  Lift goal type (used by ProgressView)                              */
/* ------------------------------------------------------------------ */

export interface LiftGoal {
	liftId: string
	weight: number
}
