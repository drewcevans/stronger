/**
 * Hard-coded sample workout data for UI development.
 *
 * Exports default lift configs and exercise templates separately so the
 * sheet integration can write defaults on first connect and recompute
 * workouts from sheet-sourced configs on subsequent visits.
 */

import type { ExerciseTemplate, LiftConfig, Workout, ComputedExercise } from '../model/index.js';
import { computeExercise } from '../model/index.js';

// ---------------------------------------------------------------------------
// Lift configurations — defaults written to the sheet on first connect
// ---------------------------------------------------------------------------

export const defaultLiftConfigs: LiftConfig[] = [
	{
		id: 'bench',
		name: 'Bench Press',
		topSetWeight: 200,
		backoffWeight: 170,
		increment: 2.5,
		minimumWeight: 95,
		roundingFactor: 5,
	},
	{
		id: 'squat',
		name: 'Squat',
		topSetWeight: 300,
		backoffWeight: 255,
		increment: 5,
		minimumWeight: 95,
		roundingFactor: 5,
	},
	{
		id: 'press',
		name: 'Press',
		topSetWeight: 140,
		backoffWeight: 120,
		increment: 2.5,
		minimumWeight: 65,
		roundingFactor: 2.5,
	},
	{
		id: 'deadlift',
		name: 'Deadlift',
		topSetWeight: 350,
		backoffWeight: 300,
		increment: 5,
		minimumWeight: 135,
		roundingFactor: 5,
	},
	{
		id: 'skull-crusher',
		name: 'Skull Crusher',
		topSetWeight: 60,
		backoffWeight: 51,
		increment: 2.5,
		minimumWeight: 20,
		roundingFactor: 2.5,
	},
	{
		id: 'barbell-row',
		name: 'Barbell Row',
		topSetWeight: 185,
		backoffWeight: 155,
		increment: 5,
		minimumWeight: 95,
		roundingFactor: 5,
	},
];


// ---------------------------------------------------------------------------
// Workout templates (exercise order + set structure) — exported for reuse
// ---------------------------------------------------------------------------

export const workoutAExercises: ExerciseTemplate[] = [
	{
		liftId: 'bench',
		name: 'Primary: Bench Press',
		sets: [
			{ setType: 'warmup', percentage: 0.5, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'warmup', percentage: 0.6, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'warmup', percentage: 0.7, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 3, amrap: false },
			{ setType: 'warmup', percentage: 0.8, weightBasis: { kind: 'topSet' }, minReps: 1, maxReps: 1, amrap: false },
			{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: true, comment: 'If 5 reps completed, increase by 2.5 lbs next week' },
			{ setType: 'backoff', percentage: 1.0, weightBasis: { kind: 'backoff' }, minReps: 5, maxReps: 8, amrap: true },
			{ setType: 'backoff', percentage: 1.0, weightBasis: { kind: 'backoff' }, minReps: 5, maxReps: 8, amrap: true },
			{ setType: 'backoff', percentage: 1.0, weightBasis: { kind: 'backoff' }, minReps: 5, maxReps: 8, amrap: true },
		],
	},
	{
		liftId: 'squat',
		name: 'Secondary: Squat',
		sets: [
			{ setType: 'warmup', percentage: 0.5, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'warmup', percentage: 0.6, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'warmup', percentage: 0.7, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 3, amrap: false },
			{ setType: 'work', percentage: 0.85, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'work', percentage: 0.85, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'work', percentage: 0.85, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
		],
	},
	{
		liftId: 'skull-crusher',
		name: 'Assistance: Skull Crusher',
		sets: [
			{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 10, maxReps: 15, amrap: false },
			{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 10, maxReps: 15, amrap: false },
			{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 10, maxReps: 15, amrap: false },
		],
	},
];

export const workoutBExercises: ExerciseTemplate[] = [
	{
		liftId: 'squat',
		name: 'Primary: Squat',
		sets: [
			{ setType: 'warmup', percentage: 0.5, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'warmup', percentage: 0.6, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'warmup', percentage: 0.7, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 3, amrap: false },
			{ setType: 'warmup', percentage: 0.8, weightBasis: { kind: 'topSet' }, minReps: 1, maxReps: 1, amrap: false },
			{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: true, comment: 'If 5 reps completed, increase by 5 lbs next week' },
			{ setType: 'backoff', percentage: 1.0, weightBasis: { kind: 'backoff' }, minReps: 5, maxReps: 8, amrap: true },
			{ setType: 'backoff', percentage: 1.0, weightBasis: { kind: 'backoff' }, minReps: 5, maxReps: 8, amrap: true },
			{ setType: 'backoff', percentage: 1.0, weightBasis: { kind: 'backoff' }, minReps: 5, maxReps: 8, amrap: true },
		],
	},
	{
		liftId: 'press',
		name: 'Secondary: Press',
		sets: [
			{ setType: 'warmup', percentage: 0.5, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'warmup', percentage: 0.6, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'warmup', percentage: 0.7, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 3, amrap: false },
			{ setType: 'work', percentage: 0.85, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'work', percentage: 0.85, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'work', percentage: 0.85, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
		],
	},
	{
		liftId: 'barbell-row',
		name: 'Assistance: Barbell Row',
		sets: [
			{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 8, maxReps: 12, amrap: false },
			{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 8, maxReps: 12, amrap: false },
			{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 8, maxReps: 12, amrap: false },
		],
	},
];

export const workoutCExercises: ExerciseTemplate[] = [
	{
		liftId: 'press',
		name: 'Primary: Press',
		sets: [
			{ setType: 'warmup', percentage: 0.5, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'warmup', percentage: 0.6, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'warmup', percentage: 0.7, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 3, amrap: false },
			{ setType: 'warmup', percentage: 0.8, weightBasis: { kind: 'topSet' }, minReps: 1, maxReps: 1, amrap: false },
			{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: true, comment: 'If 5 reps completed, increase by 2.5 lbs next week' },
			{ setType: 'backoff', percentage: 1.0, weightBasis: { kind: 'backoff' }, minReps: 5, maxReps: 8, amrap: true },
			{ setType: 'backoff', percentage: 1.0, weightBasis: { kind: 'backoff' }, minReps: 5, maxReps: 8, amrap: true },
			{ setType: 'backoff', percentage: 1.0, weightBasis: { kind: 'backoff' }, minReps: 5, maxReps: 8, amrap: true },
		],
	},
	{
		liftId: 'deadlift',
		name: 'Secondary: Deadlift',
		sets: [
			{ setType: 'warmup', percentage: 0.5, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'warmup', percentage: 0.6, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'warmup', percentage: 0.7, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 3, amrap: false },
			{ setType: 'work', percentage: 0.85, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'work', percentage: 0.85, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'work', percentage: 0.85, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
		],
	},
	{
		liftId: 'skull-crusher',
		name: 'Assistance: Skull Crusher',
		sets: [
			{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 10, maxReps: 15, amrap: false },
			{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 10, maxReps: 15, amrap: false },
			{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 10, maxReps: 15, amrap: false },
		],
	},
];

export const workoutDExercises: ExerciseTemplate[] = [
	{
		liftId: 'deadlift',
		name: 'Primary: Deadlift',
		sets: [
			{ setType: 'warmup', percentage: 0.5, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'warmup', percentage: 0.6, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'warmup', percentage: 0.7, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 3, amrap: false },
			{ setType: 'warmup', percentage: 0.8, weightBasis: { kind: 'topSet' }, minReps: 1, maxReps: 1, amrap: false },
			{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: true, comment: 'If 5 reps completed, increase by 5 lbs next week' },
			{ setType: 'backoff', percentage: 1.0, weightBasis: { kind: 'backoff' }, minReps: 5, maxReps: 8, amrap: true },
			{ setType: 'backoff', percentage: 1.0, weightBasis: { kind: 'backoff' }, minReps: 5, maxReps: 8, amrap: true },
			{ setType: 'backoff', percentage: 1.0, weightBasis: { kind: 'backoff' }, minReps: 5, maxReps: 8, amrap: true },
		],
	},
	{
		liftId: 'bench',
		name: 'Secondary: Bench Press',
		sets: [
			{ setType: 'warmup', percentage: 0.5, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'warmup', percentage: 0.6, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'warmup', percentage: 0.7, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 3, amrap: false },
			{ setType: 'work', percentage: 0.85, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'work', percentage: 0.85, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'work', percentage: 0.85, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
		],
	},
	{
		liftId: 'barbell-row',
		name: 'Assistance: Barbell Row',
		sets: [
			{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 8, maxReps: 12, amrap: false },
			{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 8, maxReps: 12, amrap: false },
			{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 8, maxReps: 12, amrap: false },
		],
	},
];

// ---------------------------------------------------------------------------
// Workout definitions (id + name + template list)
// ---------------------------------------------------------------------------

export interface WorkoutDefinition {
	id: string;
	name: string;
	templates: ExerciseTemplate[];
}

export const workoutDefinitions: WorkoutDefinition[] = [
	{ id: 'A', name: 'Workout A — Bench / Squat', templates: workoutAExercises },
	{ id: 'B', name: 'Workout B — Squat / Press', templates: workoutBExercises },
	{ id: 'C', name: 'Workout C — Press / Deadlift', templates: workoutCExercises },
	{ id: 'D', name: 'Workout D — Deadlift / Bench', templates: workoutDExercises },
];

// ---------------------------------------------------------------------------
// Computed workouts (ready for display)
// ---------------------------------------------------------------------------

/**
 * Build workouts from a set of LiftConfig values.
 * Used by the sheet integration to compute workouts from sheet-sourced configs.
 *
 * Exercises whose liftId is not present in `configs` are silently skipped.
 * Workouts with no remaining exercises are excluded from the result.
 */
export function buildWorkoutsFromConfigs(configs: LiftConfig[]): Workout[] {
	const map = new Map(configs.map((c) => [c.id, c]));
	return workoutDefinitions
		.map((def) => {
			const exercises = def.templates
				.map((t) => computeExercise(t, map))
				.filter((e): e is ComputedExercise => e !== null && e.sets.length > 0);
			return {
				id: def.id,
				name: def.name,
				exercises,
			};
		})
		.filter((w) => w.exercises.length > 0);
}

export const sampleWorkouts: Workout[] = buildWorkoutsFromConfigs(defaultLiftConfigs);
