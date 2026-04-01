/**
 * Hard-coded sample workout data for UI development.
 *
 * Uses the existing model types and compute functions to generate realistic
 * workout data modeled after RSS Intermediate programming. This will be
 * replaced by data fetched from Google Sheets in a future spec.
 */

import type { ExerciseTemplate, LiftConfig, Workout } from '../model/index.js';
import { computeExercise } from '../model/index.js';

// ---------------------------------------------------------------------------
// Lift configurations (mirroring what would live in the Google Sheet)
// ---------------------------------------------------------------------------

const liftConfigs: LiftConfig[] = [
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

const configMap = new Map(liftConfigs.map((c) => [c.id, c]));

// ---------------------------------------------------------------------------
// Workout templates (exercise order + set structure)
// ---------------------------------------------------------------------------

const workoutAExercises: ExerciseTemplate[] = [
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

const workoutBExercises: ExerciseTemplate[] = [
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

const workoutCExercises: ExerciseTemplate[] = [
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

const workoutDExercises: ExerciseTemplate[] = [
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
// Computed workouts (ready for display)
// ---------------------------------------------------------------------------

function buildWorkout(
	id: string,
	name: string,
	templates: ExerciseTemplate[],
): Workout {
	return {
		id,
		name,
		exercises: templates.map((t) => computeExercise(t, configMap)),
	};
}

export const sampleWorkouts: Workout[] = [
	buildWorkout('A', 'Workout A — Bench / Squat', workoutAExercises),
	buildWorkout('B', 'Workout B — Squat / Press', workoutBExercises),
	buildWorkout('C', 'Workout C — Press / Deadlift', workoutCExercises),
	buildWorkout('D', 'Workout D — Deadlift / Bench', workoutDExercises),
];
