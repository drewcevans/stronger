import { describe, expect, it } from 'vitest';
import { sampleWorkouts } from '../sample-workouts.js';

describe('sampleWorkouts', () => {
	it('provides exactly 4 workouts (A–D)', () => {
		expect(sampleWorkouts).toHaveLength(4);
		expect(sampleWorkouts.map((w) => w.id)).toEqual([
			'A',
			'B',
			'C',
			'D',
		]);
	});

	it('each workout has a non-empty name', () => {
		for (const workout of sampleWorkouts) {
			expect(workout.name).toBeTruthy();
		}
	});

	it('each workout contains at least 2 exercises', () => {
		for (const workout of sampleWorkouts) {
			expect(workout.exercises.length).toBeGreaterThanOrEqual(2);
		}
	});

	it('every exercise has at least one set', () => {
		for (const workout of sampleWorkouts) {
			for (const exercise of workout.exercises) {
				expect(exercise.sets.length).toBeGreaterThan(0);
			}
		}
	});

	it('all set weights are positive numbers', () => {
		for (const workout of sampleWorkouts) {
			for (const exercise of workout.exercises) {
				for (const set of exercise.sets) {
					expect(set.weight).toBeGreaterThan(0);
				}
			}
		}
	});

	it('all rep ranges are valid (minReps ≤ maxReps, both > 0)', () => {
		for (const workout of sampleWorkouts) {
			for (const exercise of workout.exercises) {
				for (const set of exercise.sets) {
					expect(set.minReps).toBeGreaterThan(0);
					expect(set.maxReps).toBeGreaterThanOrEqual(set.minReps);
				}
			}
		}
	});

	it('workout A has bench press as the primary lift', () => {
		const a = sampleWorkouts[0];
		expect(a.exercises[0].name).toContain('Bench Press');
		expect(a.exercises[0].liftId).toBe('bench');
	});

	it('workout B has squat as the primary lift', () => {
		const b = sampleWorkouts[1];
		expect(b.exercises[0].name).toContain('Squat');
		expect(b.exercises[0].liftId).toBe('squat');
	});
});
