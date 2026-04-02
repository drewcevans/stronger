import { describe, it, expect } from 'vitest';
import {
	defaultLiftConfigs,
	buildWorkoutsFromConfigs,
	workoutDefinitions,
} from '../sample-workouts.ts';

describe('buildWorkoutsFromConfigs', () => {
	it('produces 4 workouts from default configs', () => {
		const workouts = buildWorkoutsFromConfigs(defaultLiftConfigs);
		expect(workouts).toHaveLength(4);
	});

	it('uses workout definitions for ids and names', () => {
		const workouts = buildWorkoutsFromConfigs(defaultLiftConfigs);
		for (let i = 0; i < workoutDefinitions.length; i++) {
			expect(workouts[i].id).toBe(workoutDefinitions[i].id);
			expect(workouts[i].name).toBe(workoutDefinitions[i].name);
		}
	});

	it('computes different weights when config values change', () => {
		const original = buildWorkoutsFromConfigs(defaultLiftConfigs);
		const modified = defaultLiftConfigs.map((c) =>
			c.id === 'bench' ? { ...c, topSetWeight: 225 } : c,
		);
		const updated = buildWorkoutsFromConfigs(modified);

		// Workout A primary exercise is bench — the work set weight should differ
		const originalBenchWork = original[0].exercises[0].sets.find(
			(s) => s.setType === 'work',
		);
		const updatedBenchWork = updated[0].exercises[0].sets.find(
			(s) => s.setType === 'work',
		);
		expect(updatedBenchWork!.weight).not.toBe(originalBenchWork!.weight);
		expect(updatedBenchWork!.weight).toBe(225);
	});

	it('each workout has exercises with positive weights', () => {
		const workouts = buildWorkoutsFromConfigs(defaultLiftConfigs);
		for (const w of workouts) {
			for (const ex of w.exercises) {
				for (const set of ex.sets) {
					expect(set.weight).toBeGreaterThan(0);
				}
			}
		}
	});
});
