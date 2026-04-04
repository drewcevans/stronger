/**
 * Default workout data sourced from the JSON library files in lib/.
 *
 * Exports default lift configs and workout definitions so the sheet
 * integration can write defaults on first connect and recompute
 * workouts from sheet-sourced configs on subsequent visits.
 */

import type { ExerciseTemplate, LiftConfig, Workout, ComputedExercise, ActivityType } from '../model/index.js';
import { computeExercise } from '../model/index.js';

import exercisesJson from '../../lib/exercises.json';
import workoutsJson from '../../lib/workouts.json';

// ---------------------------------------------------------------------------
// Lift configurations — defaults written to the sheet on first connect
// ---------------------------------------------------------------------------

export const defaultLiftConfigs: LiftConfig[] = exercisesJson as LiftConfig[];

// ---------------------------------------------------------------------------
// Workout definitions (id + name + template list)
// ---------------------------------------------------------------------------

export interface WorkoutDefinition {
	id: string;
	name: string;
	/** Activity category; defaults to 'strength' when omitted. */
	category?: ActivityType;
	/** Whether this workout appears in the favorites list; defaults to false. */
	favorite?: boolean;
	templates: ExerciseTemplate[];
}

export const workoutDefinitions: WorkoutDefinition[] = workoutsJson as WorkoutDefinition[];

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
			const category = def.category ?? 'strength';
			const exercises = def.templates
				.map((t) => computeExercise(t, map))
				.filter((e): e is ComputedExercise => e !== null && e.sets.length > 0);
			return {
				id: def.id,
				name: def.name,
				category,
				favorite: def.favorite ?? false,
				exercises,
			};
		})
		.filter((w) => w.category === 'cardio' || w.exercises.length > 0);
}

export const sampleWorkouts: Workout[] = buildWorkoutsFromConfigs(defaultLiftConfigs);
