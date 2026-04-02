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
		id: 'chin-up',
		name: 'Chin-up',
		topSetWeight: 0,
		backoffWeight: 0,
		increment: 5,
		minimumWeight: 0,
		roundingFactor: 5,
	},
	{
		id: 'bicep-curl',
		name: 'Bicep Curl',
		topSetWeight: 30,
		backoffWeight: 25,
		increment: 2.5,
		minimumWeight: 10,
		roundingFactor: 2.5,
	},
	{
		id: 'lateral-raise',
		name: 'Lateral Raise',
		topSetWeight: 15,
		backoffWeight: 12.5,
		increment: 2.5,
		minimumWeight: 5,
		roundingFactor: 2.5,
	},
	{
		id: 'dumbbell-row',
		name: 'Dumbbell Row',
		topSetWeight: 60,
		backoffWeight: 50,
		increment: 5,
		minimumWeight: 20,
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
			{ setType: 'warmup', percentage: 1.0, weightBasis: { kind: 'fixed', weight: 45 }, minReps: 10, maxReps: 10, amrap: false },
			{ setType: 'warmup', percentage: 0.45, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'warmup', percentage: 0.65, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 3, amrap: false },
			{ setType: 'warmup', percentage: 0.85, weightBasis: { kind: 'topSet' }, minReps: 2, maxReps: 2, amrap: false },
			{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 5, amrap: true, comment: 'Min 3 reps. If 5 reps completed, increase by 2.5 lbs next week' },
			{ setType: 'backoff', percentage: 1.0, weightBasis: { kind: 'backoff' }, minReps: 5, maxReps: 8, amrap: true, comment: 'If 8 reps completed, increase backoff weight by 2.5 lbs next week' },
		],
	},
	{
		liftId: 'press',
		name: 'Secondary: Press',
		sets: [
			{ setType: 'warmup', percentage: 1.0, weightBasis: { kind: 'fixed', weight: 45 }, minReps: 10, maxReps: 10, amrap: false },
			{ setType: 'warmup', percentage: 0.3825, weightBasis: { kind: 'crossReference', liftId: 'press' }, minReps: 5, maxReps: 5, amrap: false }, // 45% of 85%
			{ setType: 'warmup', percentage: 0.5525, weightBasis: { kind: 'crossReference', liftId: 'press' }, minReps: 3, maxReps: 3, amrap: false }, // 65% of 85%
			{ setType: 'warmup', percentage: 0.7225, weightBasis: { kind: 'crossReference', liftId: 'press' }, minReps: 2, maxReps: 2, amrap: false }, // 85% of 85%
			{ setType: 'work', percentage: 0.85, weightBasis: { kind: 'crossReference', liftId: 'press' }, minReps: 5, maxReps: 8, amrap: false }, // 100% of 85%
			{ setType: 'backoff', percentage: 0.7225, weightBasis: { kind: 'crossReference', liftId: 'press' }, minReps: 5, maxReps: 8, amrap: true }, // 85% of 85%
		],
	},
	{
		liftId: 'skull-crusher',
		name: 'Assistance: Skull Crusher',
		sets: [
			{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 8, maxReps: 8, amrap: false },
			{ setType: 'backoff', percentage: 1.0, weightBasis: { kind: 'backoff' }, minReps: 8, maxReps: 8, amrap: true },
		],
	},
];

export const workoutBExercises: ExerciseTemplate[] = [
	{
		liftId: 'squat',
		name: 'Primary: Squat',
		sets: [
			{ setType: 'warmup', percentage: 1.0, weightBasis: { kind: 'fixed', weight: 45 }, minReps: 10, maxReps: 10, amrap: false },
			{ setType: 'warmup', percentage: 0.45, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'warmup', percentage: 0.65, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 3, amrap: false },
			{ setType: 'warmup', percentage: 0.85, weightBasis: { kind: 'topSet' }, minReps: 2, maxReps: 2, amrap: false },
			{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 5, amrap: true, comment: 'Min 3 reps. If 5 reps completed, increase by 5 lbs next week' },
			{ setType: 'backoff', percentage: 1.0, weightBasis: { kind: 'backoff' }, minReps: 5, maxReps: 8, amrap: true, comment: 'If 8 reps completed, increase backoff weight by 5 lbs next week' },
		],
	},
	{
		liftId: 'deadlift',
		name: 'Secondary: Deadlift',
		sets: [
			{ setType: 'warmup', percentage: 0.3825, weightBasis: { kind: 'crossReference', liftId: 'deadlift' }, minReps: 5, maxReps: 5, amrap: false }, // 45% of 85%
			{ setType: 'warmup', percentage: 0.5525, weightBasis: { kind: 'crossReference', liftId: 'deadlift' }, minReps: 3, maxReps: 3, amrap: false }, // 65% of 85%
			{ setType: 'warmup', percentage: 0.7225, weightBasis: { kind: 'crossReference', liftId: 'deadlift' }, minReps: 2, maxReps: 2, amrap: false }, // 85% of 85%
			{ setType: 'work', percentage: 0.85, weightBasis: { kind: 'crossReference', liftId: 'deadlift' }, minReps: 5, maxReps: 5, amrap: false }, // 100% of 85%
		],
	},
	{
		liftId: 'chin-up',
		name: 'Assistance: Chin-up',
		sets: [
			{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 8, maxReps: 8, amrap: false },
			{ setType: 'backoff', percentage: 1.0, weightBasis: { kind: 'backoff' }, minReps: 8, maxReps: 8, amrap: true },
		],
	},
];

export const workoutCExercises: ExerciseTemplate[] = [
	{
		liftId: 'press',
		name: 'Primary: Press',
		sets: [
			{ setType: 'warmup', percentage: 1.0, weightBasis: { kind: 'fixed', weight: 45 }, minReps: 10, maxReps: 10, amrap: false },
			{ setType: 'warmup', percentage: 0.45, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'warmup', percentage: 0.65, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 3, amrap: false },
			{ setType: 'warmup', percentage: 0.85, weightBasis: { kind: 'topSet' }, minReps: 2, maxReps: 2, amrap: false },
			{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 5, amrap: true, comment: 'Min 3 reps. If 5 reps completed, increase by 2.5 lbs next week' },
			{ setType: 'backoff', percentage: 1.0, weightBasis: { kind: 'backoff' }, minReps: 5, maxReps: 8, amrap: true, comment: 'If 8 reps completed, increase backoff weight by 2.5 lbs next week' },
		],
	},
	{
		liftId: 'bench',
		name: 'Secondary: Bench Press',
		sets: [
			{ setType: 'warmup', percentage: 1.0, weightBasis: { kind: 'fixed', weight: 45 }, minReps: 10, maxReps: 10, amrap: false },
			{ setType: 'warmup', percentage: 0.3825, weightBasis: { kind: 'crossReference', liftId: 'bench' }, minReps: 5, maxReps: 5, amrap: false }, // 45% of 85%
			{ setType: 'warmup', percentage: 0.5525, weightBasis: { kind: 'crossReference', liftId: 'bench' }, minReps: 3, maxReps: 3, amrap: false }, // 65% of 85%
			{ setType: 'warmup', percentage: 0.7225, weightBasis: { kind: 'crossReference', liftId: 'bench' }, minReps: 2, maxReps: 2, amrap: false }, // 85% of 85%
			{ setType: 'work', percentage: 0.85, weightBasis: { kind: 'crossReference', liftId: 'bench' }, minReps: 5, maxReps: 8, amrap: false }, // 100% of 85%
			{ setType: 'backoff', percentage: 0.7225, weightBasis: { kind: 'crossReference', liftId: 'bench' }, minReps: 5, maxReps: 8, amrap: true }, // 85% of 85%
		],
	},
	{
		liftId: 'bicep-curl',
		name: 'Assistance: Bicep Curl',
		sets: [
			{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 8, maxReps: 8, amrap: false },
			{ setType: 'backoff', percentage: 1.0, weightBasis: { kind: 'backoff' }, minReps: 8, maxReps: 8, amrap: true },
		],
	},
	{
		liftId: 'lateral-raise',
		name: 'Assistance: Lateral Raise',
		sets: [
			{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 10, maxReps: 15, amrap: false, comment: 'Do not increase weight until 15 reps on all sets' },
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
			{ setType: 'warmup', percentage: 0.45, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
			{ setType: 'warmup', percentage: 0.65, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 3, amrap: false },
			{ setType: 'warmup', percentage: 0.85, weightBasis: { kind: 'topSet' }, minReps: 2, maxReps: 2, amrap: false },
			{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 5, amrap: true, comment: 'Min 3 reps. If 5 reps completed, increase by 5 lbs next week' },
			{ setType: 'backoff', percentage: 1.0, weightBasis: { kind: 'backoff' }, minReps: 5, maxReps: 8, amrap: true, comment: 'Optional. If 8 reps completed, increase backoff weight by 5 lbs next week' },
		],
	},
	{
		liftId: 'squat',
		name: 'Secondary: Squat',
		sets: [
			{ setType: 'warmup', percentage: 1.0, weightBasis: { kind: 'fixed', weight: 45 }, minReps: 10, maxReps: 10, amrap: false },
			{ setType: 'warmup', percentage: 0.3375, weightBasis: { kind: 'crossReference', liftId: 'squat' }, minReps: 5, maxReps: 5, amrap: false }, // 45% of 75%
			{ setType: 'warmup', percentage: 0.4875, weightBasis: { kind: 'crossReference', liftId: 'squat' }, minReps: 3, maxReps: 3, amrap: false }, // 65% of 75%
			{ setType: 'warmup', percentage: 0.6375, weightBasis: { kind: 'crossReference', liftId: 'squat' }, minReps: 2, maxReps: 2, amrap: false }, // 85% of 75%
			{ setType: 'work', percentage: 0.75, weightBasis: { kind: 'crossReference', liftId: 'squat' }, minReps: 5, maxReps: 5, amrap: false }, // 100% of 75%
			{ setType: 'work', percentage: 0.75, weightBasis: { kind: 'crossReference', liftId: 'squat' }, minReps: 5, maxReps: 5, amrap: false }, // 100% of 75%
			{ setType: 'work', percentage: 0.75, weightBasis: { kind: 'crossReference', liftId: 'squat' }, minReps: 5, maxReps: 5, amrap: false }, // 100% of 75%
		],
	},
	{
		liftId: 'dumbbell-row',
		name: 'Assistance: Dumbbell Row',
		sets: [
			{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 8, maxReps: 8, amrap: false },
			{ setType: 'backoff', percentage: 1.0, weightBasis: { kind: 'backoff' }, minReps: 8, maxReps: 8, amrap: true },
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
	{ id: 'A', name: 'Workout A — Bench / Press', templates: workoutAExercises },
	{ id: 'B', name: 'Workout B — Squat / Deadlift', templates: workoutBExercises },
	{ id: 'C', name: 'Workout C — Press / Bench', templates: workoutCExercises },
	{ id: 'D', name: 'Workout D — Deadlift / Squat', templates: workoutDExercises },
];

// ---------------------------------------------------------------------------
// Computed workouts (ready for display)
// ---------------------------------------------------------------------------

/**
 * Build workouts from a set of LiftConfig values and workout definitions.
 * Used by the sheet integration to compute workouts from sheet-sourced data.
 *
 * Exercises whose liftId is not present in `configs` are silently skipped.
 * Workouts with no remaining exercises are excluded from the result.
 *
 * @param configs - lift configurations (weights, rounding, etc.)
 * @param definitions - workout definitions; defaults to the hard-coded
 *   `workoutDefinitions` for backward compatibility during first-connect seeding.
 */
export function buildWorkoutsFromConfigs(
	configs: LiftConfig[],
	definitions: WorkoutDefinition[] = workoutDefinitions,
): Workout[] {
	const map = new Map(configs.map((c) => [c.id, c]));
	return definitions
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
