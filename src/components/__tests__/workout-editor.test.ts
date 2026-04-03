import { describe, it, expect } from 'vitest';
import { nameToId, toEditable, fromEditable } from '../WorkoutEditor.js';
import type { EditableWorkout } from '../WorkoutEditor.js';
import type { WorkoutDefinition } from '../../data/sample-workouts.js';
import type { LiftConfig } from '../../model/types.js';

/* ------------------------------------------------------------------ */
/*  nameToId – kebab-case slug generation                              */
/* ------------------------------------------------------------------ */

describe('nameToId', () => {
	it('converts a simple name to kebab-case', () => {
		expect(nameToId('Workout A')).toBe('workout-a');
	});

	it('strips leading and trailing hyphens', () => {
		expect(nameToId('  Workout A  ')).toBe('workout-a');
	});

	it('collapses multiple special characters into a single hyphen', () => {
		expect(nameToId('Bench / Press')).toBe('bench-press');
	});

	it('returns empty string for empty input', () => {
		expect(nameToId('')).toBe('');
	});

	it('handles names with em-dashes and special characters', () => {
		expect(nameToId('Workout A — Bench / Press')).toBe('workout-a-bench-press');
	});

	it('preserves digits', () => {
		expect(nameToId('Phase 2 Workout')).toBe('phase-2-workout');
	});
});

/* ------------------------------------------------------------------ */
/*  toEditable – WorkoutDefinition → EditableWorkout                   */
/* ------------------------------------------------------------------ */

describe('toEditable', () => {
	it('converts a strength workout definition', () => {
		const def: WorkoutDefinition = {
			id: 'A',
			name: 'Workout A',
			category: 'strength',
			templates: [
				{
					liftId: 'bench',
					name: 'Primary: Bench Press',
					sets: [
						{
							setType: 'work',
							percentage: 1.0,
							weightBasis: { kind: 'topSet' },
							minReps: 5,
							maxReps: 5,
							amrap: true,
							comment: 'Test',
						},
					],
				},
			],
		};
		const result = toEditable(def);
		expect(result.id).toBe('A');
		expect(result.name).toBe('Workout A');
		expect(result.category).toBe('strength');
		expect(result.exercises).toHaveLength(1);
		expect(result.exercises[0].liftId).toBe('bench');
		expect(result.exercises[0].role).toBe('primary');
		expect(result.exercises[0].sets).toHaveLength(1);
		expect(result.exercises[0].sets[0].comment).toBe('Test');
	});

	it('infers role from exercise name prefix', () => {
		const def: WorkoutDefinition = {
			id: 'A',
			name: 'Workout A',
			templates: [
				{
					liftId: 'bench',
					name: 'Secondary: Bench Press',
					sets: [{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false }],
				},
				{
					liftId: 'curl',
					name: 'Assistance: Bicep Curl',
					sets: [{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 8, maxReps: 8, amrap: false }],
				},
				{
					liftId: 'squat',
					name: 'Custom Name',
					sets: [{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false }],
				},
			],
		};
		const result = toEditable(def);
		expect(result.exercises[0].role).toBe('secondary');
		expect(result.exercises[1].role).toBe('assistance');
		expect(result.exercises[2].role).toBe('assistance'); // default fallback
	});

	it('defaults category to strength when omitted', () => {
		const def: WorkoutDefinition = {
			id: 'X',
			name: 'Test',
			templates: [],
		};
		const result = toEditable(def);
		expect(result.category).toBe('strength');
	});

	it('converts a cardio definition', () => {
		const def: WorkoutDefinition = {
			id: 'run',
			name: 'Easy Run',
			category: 'cardio',
			templates: [],
		};
		const result = toEditable(def);
		expect(result.category).toBe('cardio');
		expect(result.exercises).toHaveLength(0);
	});
});

/* ------------------------------------------------------------------ */
/*  fromEditable – EditableWorkout → WorkoutDefinition                 */
/* ------------------------------------------------------------------ */

describe('fromEditable', () => {
	const configs: LiftConfig[] = [
		{ id: 'bench', name: 'Bench Press', topSetWeight: 200, backoffWeight: 170, increment: 2.5, minimumWeight: 95, roundingFactor: 5 },
		{ id: 'squat', name: 'Squat', topSetWeight: 300, backoffWeight: 255, increment: 5, minimumWeight: 95, roundingFactor: 5 },
	];

	it('converts a strength workout back to a definition', () => {
		const editable: EditableWorkout = {
			id: 'A',
			name: 'Workout A',
			category: 'strength',
			exercises: [
				{
					liftId: 'bench',
					role: 'primary',
					sets: [
						{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: true },
					],
				},
			],
		};
		const result = fromEditable(editable, configs);
		expect(result.id).toBe('A');
		expect(result.name).toBe('Workout A');
		expect(result.category).toBe('strength');
		expect(result.templates).toHaveLength(1);
		expect(result.templates[0].liftId).toBe('bench');
		expect(result.templates[0].name).toBe('Primary: Bench Press');
		expect(result.templates[0].sets).toHaveLength(1);
	});

	it('derives exercise display name from role and lift name', () => {
		const editable: EditableWorkout = {
			id: 'X',
			name: 'Test',
			category: 'strength',
			exercises: [
				{ liftId: 'squat', role: 'secondary', sets: [{ setType: 'work', percentage: 0.85, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false }] },
			],
		};
		const result = fromEditable(editable, configs);
		expect(result.templates[0].name).toBe('Secondary: Squat');
	});

	it('falls back to liftId when lift name not found in configs', () => {
		const editable: EditableWorkout = {
			id: 'X',
			name: 'Test',
			category: 'strength',
			exercises: [
				{ liftId: 'unknown-lift', role: 'assistance', sets: [{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 8, maxReps: 8, amrap: false }] },
			],
		};
		const result = fromEditable(editable, configs);
		expect(result.templates[0].name).toBe('Assistance: unknown-lift');
	});

	it('converts a cardio workout', () => {
		const editable: EditableWorkout = {
			id: 'run',
			name: 'Easy Run',
			category: 'cardio',
			exercises: [],
		};
		const result = fromEditable(editable, configs);
		expect(result.category).toBe('cardio');
		expect(result.templates).toHaveLength(0);
	});

	it('preserves set comments through round-trip', () => {
		const def: WorkoutDefinition = {
			id: 'A',
			name: 'Workout A',
			category: 'strength',
			templates: [
				{
					liftId: 'bench',
					name: 'Primary: Bench Press',
					sets: [
						{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 5, amrap: true, comment: 'If 5 reps, increase' },
					],
				},
			],
		};
		const editable = toEditable(def);
		const result = fromEditable(editable, configs);
		expect(result.templates[0].sets[0].comment).toBe('If 5 reps, increase');
	});
});
