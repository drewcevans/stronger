import { describe, expect, it } from 'vitest';

import type {
	ComputedExercise,
	ExerciseTemplate,
	LiftConfig,
	SetResult,
} from '../types.js';
import { computeProgression, isSecondaryExercise } from '../progression.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const benchConfig: LiftConfig = {
	id: 'bench',
	name: 'Bench Press',
	topSetWeight: 200,
	backoffWeight: 170,
	increment: 2.5,
	minimumWeight: 95,
	roundingFactor: 5,
};

const pressConfig: LiftConfig = {
	id: 'press',
	name: 'Press',
	topSetWeight: 140,
	backoffWeight: 120,
	increment: 2.5,
	minimumWeight: 65,
	roundingFactor: 2.5,
};

const skullCrusherConfig: LiftConfig = {
	id: 'skull-crusher',
	name: 'Skull Crusher',
	topSetWeight: 60,
	backoffWeight: 51,
	increment: 2.5,
	minimumWeight: 20,
	roundingFactor: 2.5,
};

// ---------------------------------------------------------------------------
// isSecondaryExercise
// ---------------------------------------------------------------------------

describe('isSecondaryExercise', () => {
	it('returns true when all work/backoff sets use crossReference', () => {
		const template: ExerciseTemplate = {
			liftId: 'press',
			name: 'Secondary: Press',
			sets: [
				{
					setType: 'warmup',
					percentage: 1.0,
					weightBasis: { kind: 'fixed', weight: 45 },
					minReps: 10,
					maxReps: 10,
					amrap: false,
				},
				{
					setType: 'work',
					percentage: 0.85,
					weightBasis: { kind: 'crossReference', liftId: 'press' },
					minReps: 5,
					maxReps: 8,
					amrap: false,
				},
				{
					setType: 'backoff',
					percentage: 0.7225,
					weightBasis: { kind: 'crossReference', liftId: 'press' },
					minReps: 5,
					maxReps: 8,
					amrap: true,
				},
			],
		};
		expect(isSecondaryExercise(template)).toBe(true);
	});

	it('returns false when work sets use topSet basis', () => {
		const template: ExerciseTemplate = {
			liftId: 'bench',
			name: 'Primary: Bench Press',
			sets: [
				{
					setType: 'work',
					percentage: 1.0,
					weightBasis: { kind: 'topSet' },
					minReps: 3,
					maxReps: 5,
					amrap: true,
				},
				{
					setType: 'backoff',
					percentage: 1.0,
					weightBasis: { kind: 'backoff' },
					minReps: 5,
					maxReps: 8,
					amrap: true,
				},
			],
		};
		expect(isSecondaryExercise(template)).toBe(false);
	});

	it('returns false when exercise has no work/backoff sets', () => {
		const template: ExerciseTemplate = {
			liftId: 'bench',
			name: 'Warmup Only',
			sets: [
				{
					setType: 'warmup',
					percentage: 1.0,
					weightBasis: { kind: 'fixed', weight: 45 },
					minReps: 10,
					maxReps: 10,
					amrap: false,
				},
			],
		};
		expect(isSecondaryExercise(template)).toBe(false);
	});

	it('returns false when some work sets use topSet and some crossReference', () => {
		const template: ExerciseTemplate = {
			liftId: 'bench',
			name: 'Mixed',
			sets: [
				{
					setType: 'work',
					percentage: 1.0,
					weightBasis: { kind: 'topSet' },
					minReps: 3,
					maxReps: 5,
					amrap: true,
				},
				{
					setType: 'work',
					percentage: 0.85,
					weightBasis: { kind: 'crossReference', liftId: 'press' },
					minReps: 5,
					maxReps: 8,
					amrap: false,
				},
			],
		};
		expect(isSecondaryExercise(template)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// computeProgression
// ---------------------------------------------------------------------------

describe('computeProgression', () => {
	const configs = [benchConfig, pressConfig, skullCrusherConfig];

	it('proposes weight increase when top-set rep target is met', () => {
		const exercises: ComputedExercise[] = [
			{
				liftId: 'bench',
				name: 'Primary: Bench Press',
				sets: [
					{ setType: 'work', weight: 200, minReps: 3, maxReps: 5, amrap: true },
					{ setType: 'backoff', weight: 170, minReps: 5, maxReps: 8, amrap: true },
				],
			},
		];
		const templates: ExerciseTemplate[] = [
			{
				liftId: 'bench',
				name: 'Primary: Bench Press',
				sets: [
					{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 5, amrap: true },
					{ setType: 'backoff', percentage: 1.0, weightBasis: { kind: 'backoff' }, minReps: 5, maxReps: 8, amrap: true },
				],
			},
		];
		const results: SetResult[][] = [
			[
				{ actualWeight: 200, actualReps: 5, completed: true, actualSetType: 'work' },
				{ actualWeight: 170, actualReps: 6, completed: true, actualSetType: 'backoff' },
			],
		];

		const proposals = computeProgression(exercises, results, configs, templates);
		expect(proposals).toHaveLength(1);
		expect(proposals[0].liftId).toBe('bench');
		expect(proposals[0].topSetHit).toBe(true);
		expect(proposals[0].backoffHit).toBe(false);
		expect(proposals[0].proposedTopSetWeight).toBe(202.5); // 200 + 2.5
		expect(proposals[0].proposedBackoffWeight).toBe(170); // no change
	});

	it('proposes no change when rep target is not met', () => {
		const exercises: ComputedExercise[] = [
			{
				liftId: 'bench',
				name: 'Primary: Bench Press',
				sets: [
					{ setType: 'work', weight: 200, minReps: 3, maxReps: 5, amrap: true },
					{ setType: 'backoff', weight: 170, minReps: 5, maxReps: 8, amrap: true },
				],
			},
		];
		const templates: ExerciseTemplate[] = [
			{
				liftId: 'bench',
				name: 'Primary: Bench Press',
				sets: [
					{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 5, amrap: true },
					{ setType: 'backoff', percentage: 1.0, weightBasis: { kind: 'backoff' }, minReps: 5, maxReps: 8, amrap: true },
				],
			},
		];
		const results: SetResult[][] = [
			[
				{ actualWeight: 200, actualReps: 4, completed: true, actualSetType: 'work' },
				{ actualWeight: 170, actualReps: 7, completed: true, actualSetType: 'backoff' },
			],
		];

		const proposals = computeProgression(exercises, results, configs, templates);
		expect(proposals).toHaveLength(1);
		expect(proposals[0].topSetHit).toBe(false);
		expect(proposals[0].backoffHit).toBe(false);
		expect(proposals[0].proposedTopSetWeight).toBe(200);
		expect(proposals[0].proposedBackoffWeight).toBe(170);
	});

	it('proposes increase for both work and backoff when both targets met', () => {
		const exercises: ComputedExercise[] = [
			{
				liftId: 'bench',
				name: 'Primary: Bench Press',
				sets: [
					{ setType: 'work', weight: 200, minReps: 3, maxReps: 5, amrap: true },
					{ setType: 'backoff', weight: 170, minReps: 5, maxReps: 8, amrap: true },
				],
			},
		];
		const templates: ExerciseTemplate[] = [
			{
				liftId: 'bench',
				name: 'Primary: Bench Press',
				sets: [
					{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 5, amrap: true },
					{ setType: 'backoff', percentage: 1.0, weightBasis: { kind: 'backoff' }, minReps: 5, maxReps: 8, amrap: true },
				],
			},
		];
		const results: SetResult[][] = [
			[
				{ actualWeight: 200, actualReps: 5, completed: true, actualSetType: 'work' },
				{ actualWeight: 170, actualReps: 8, completed: true, actualSetType: 'backoff' },
			],
		];

		const proposals = computeProgression(exercises, results, configs, templates);
		expect(proposals).toHaveLength(1);
		expect(proposals[0].topSetHit).toBe(true);
		expect(proposals[0].backoffHit).toBe(true);
		expect(proposals[0].proposedTopSetWeight).toBe(202.5);
		expect(proposals[0].proposedBackoffWeight).toBe(172.5);
	});

	it('excludes secondary exercises (crossReference)', () => {
		const exercises: ComputedExercise[] = [
			{
				liftId: 'bench',
				name: 'Primary: Bench Press',
				sets: [
					{ setType: 'work', weight: 200, minReps: 3, maxReps: 5, amrap: true },
				],
			},
			{
				liftId: 'press',
				name: 'Secondary: Press',
				sets: [
					{ setType: 'work', weight: 120, minReps: 5, maxReps: 8, amrap: false },
				],
			},
		];
		const templates: ExerciseTemplate[] = [
			{
				liftId: 'bench',
				name: 'Primary: Bench Press',
				sets: [
					{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 5, amrap: true },
				],
			},
			{
				liftId: 'press',
				name: 'Secondary: Press',
				sets: [
					{ setType: 'work', percentage: 0.85, weightBasis: { kind: 'crossReference', liftId: 'press' }, minReps: 5, maxReps: 8, amrap: false },
				],
			},
		];
		const results: SetResult[][] = [
			[{ actualWeight: 200, actualReps: 5, completed: true, actualSetType: 'work' }],
			[{ actualWeight: 120, actualReps: 8, completed: true, actualSetType: 'work' }],
		];

		const proposals = computeProgression(exercises, results, configs, templates);
		expect(proposals).toHaveLength(1);
		expect(proposals[0].liftId).toBe('bench');
		// No proposal for press (secondary)
	});

	it('groups exercises with the same liftId', () => {
		const exercises: ComputedExercise[] = [
			{
				liftId: 'skull-crusher',
				name: 'Assistance: Skull Crusher (Exercise 1)',
				sets: [
					{ setType: 'work', weight: 60, minReps: 8, maxReps: 8, amrap: false },
				],
			},
			{
				liftId: 'skull-crusher',
				name: 'Assistance: Skull Crusher (Exercise 2)',
				sets: [
					{ setType: 'work', weight: 60, minReps: 8, maxReps: 8, amrap: false },
				],
			},
		];
		const templates: ExerciseTemplate[] = [
			{
				liftId: 'skull-crusher',
				name: 'Assistance: Skull Crusher (Exercise 1)',
				sets: [
					{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 8, maxReps: 8, amrap: false },
				],
			},
			{
				liftId: 'skull-crusher',
				name: 'Assistance: Skull Crusher (Exercise 2)',
				sets: [
					{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 8, maxReps: 8, amrap: false },
				],
			},
		];
		const results: SetResult[][] = [
			[{ actualWeight: 60, actualReps: 8, completed: true, actualSetType: 'work' }],
			[{ actualWeight: 60, actualReps: 8, completed: true, actualSetType: 'work' }],
		];

		const proposals = computeProgression(exercises, results, configs, templates);
		expect(proposals).toHaveLength(1);
		expect(proposals[0].liftId).toBe('skull-crusher');
	});

	it('ignores incomplete sets for progression', () => {
		const exercises: ComputedExercise[] = [
			{
				liftId: 'bench',
				name: 'Primary: Bench Press',
				sets: [
					{ setType: 'work', weight: 200, minReps: 3, maxReps: 5, amrap: true },
				],
			},
		];
		const templates: ExerciseTemplate[] = [
			{
				liftId: 'bench',
				name: 'Primary: Bench Press',
				sets: [
					{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 5, amrap: true },
				],
			},
		];
		const results: SetResult[][] = [
			[{ actualWeight: 200, actualReps: 5, completed: false, actualSetType: 'work' }],
		];

		const proposals = computeProgression(exercises, results, configs, templates);
		expect(proposals).toHaveLength(1);
		expect(proposals[0].topSetHit).toBe(false);
		expect(proposals[0].proposedTopSetWeight).toBe(200);
	});

	it('ignores warmup sets for progression decisions', () => {
		const exercises: ComputedExercise[] = [
			{
				liftId: 'bench',
				name: 'Primary: Bench Press',
				sets: [
					{ setType: 'warmup', weight: 95, minReps: 5, maxReps: 5, amrap: false },
					{ setType: 'work', weight: 200, minReps: 3, maxReps: 5, amrap: true },
				],
			},
		];
		const templates: ExerciseTemplate[] = [
			{
				liftId: 'bench',
				name: 'Primary: Bench Press',
				sets: [
					{ setType: 'warmup', percentage: 0.45, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
					{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 5, amrap: true },
				],
			},
		];
		const results: SetResult[][] = [
			[
				{ actualWeight: 95, actualReps: 5, completed: true, actualSetType: 'warmup' },
				{ actualWeight: 200, actualReps: 3, completed: true, actualSetType: 'work' },
			],
		];

		const proposals = computeProgression(exercises, results, configs, templates);
		expect(proposals).toHaveLength(1);
		expect(proposals[0].topSetHit).toBe(false);
		expect(proposals[0].proposedTopSetWeight).toBe(200);
	});

	it('handles reps exceeding the upper bound (still counts as hit)', () => {
		const exercises: ComputedExercise[] = [
			{
				liftId: 'bench',
				name: 'Primary: Bench Press',
				sets: [
					{ setType: 'work', weight: 200, minReps: 3, maxReps: 5, amrap: true },
				],
			},
		];
		const templates: ExerciseTemplate[] = [
			{
				liftId: 'bench',
				name: 'Primary: Bench Press',
				sets: [
					{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 5, amrap: true },
				],
			},
		];
		const results: SetResult[][] = [
			[{ actualWeight: 200, actualReps: 7, completed: true, actualSetType: 'work' }],
		];

		const proposals = computeProgression(exercises, results, configs, templates);
		expect(proposals).toHaveLength(1);
		expect(proposals[0].topSetHit).toBe(true);
		expect(proposals[0].proposedTopSetWeight).toBe(202.5);
	});

	it('returns empty array when no non-secondary exercises exist', () => {
		const exercises: ComputedExercise[] = [
			{
				liftId: 'press',
				name: 'Secondary: Press',
				sets: [
					{ setType: 'work', weight: 120, minReps: 5, maxReps: 8, amrap: false },
				],
			},
		];
		const templates: ExerciseTemplate[] = [
			{
				liftId: 'press',
				name: 'Secondary: Press',
				sets: [
					{ setType: 'work', percentage: 0.85, weightBasis: { kind: 'crossReference', liftId: 'press' }, minReps: 5, maxReps: 8, amrap: false },
				],
			},
		];
		const results: SetResult[][] = [
			[{ actualWeight: 120, actualReps: 8, completed: true, actualSetType: 'work' }],
		];

		const proposals = computeProgression(exercises, results, configs, templates);
		expect(proposals).toHaveLength(0);
	});

	it('handles a full Workout A scenario (bench primary + press secondary + skull crusher assistance)', () => {
		const exercises: ComputedExercise[] = [
			{
				liftId: 'bench',
				name: 'Primary: Bench Press',
				sets: [
					{ setType: 'warmup', weight: 45, minReps: 10, maxReps: 10, amrap: false },
					{ setType: 'warmup', weight: 95, minReps: 5, maxReps: 5, amrap: false },
					{ setType: 'warmup', weight: 130, minReps: 3, maxReps: 3, amrap: false },
					{ setType: 'warmup', weight: 170, minReps: 2, maxReps: 2, amrap: false },
					{ setType: 'work', weight: 200, minReps: 3, maxReps: 5, amrap: true },
					{ setType: 'backoff', weight: 170, minReps: 5, maxReps: 8, amrap: true },
				],
			},
			{
				liftId: 'press',
				name: 'Secondary: Press',
				sets: [
					{ setType: 'warmup', weight: 45, minReps: 10, maxReps: 10, amrap: false },
					{ setType: 'work', weight: 120, minReps: 5, maxReps: 8, amrap: false },
					{ setType: 'backoff', weight: 102.5, minReps: 5, maxReps: 8, amrap: true },
				],
			},
			{
				liftId: 'skull-crusher',
				name: 'Assistance: Skull Crusher',
				sets: [
					{ setType: 'work', weight: 60, minReps: 8, maxReps: 8, amrap: false },
					{ setType: 'backoff', weight: 50, minReps: 8, maxReps: 8, amrap: true },
				],
			},
		];
		const templates: ExerciseTemplate[] = [
			{
				liftId: 'bench',
				name: 'Primary: Bench Press',
				sets: [
					{ setType: 'warmup', percentage: 1.0, weightBasis: { kind: 'fixed', weight: 45 }, minReps: 10, maxReps: 10, amrap: false },
					{ setType: 'warmup', percentage: 0.45, weightBasis: { kind: 'topSet' }, minReps: 5, maxReps: 5, amrap: false },
					{ setType: 'warmup', percentage: 0.65, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 3, amrap: false },
					{ setType: 'warmup', percentage: 0.85, weightBasis: { kind: 'topSet' }, minReps: 2, maxReps: 2, amrap: false },
					{ setType: 'work', percentage: 1.0, weightBasis: { kind: 'topSet' }, minReps: 3, maxReps: 5, amrap: true },
					{ setType: 'backoff', percentage: 1.0, weightBasis: { kind: 'backoff' }, minReps: 5, maxReps: 8, amrap: true },
				],
			},
			{
				liftId: 'press',
				name: 'Secondary: Press',
				sets: [
					{ setType: 'warmup', percentage: 1.0, weightBasis: { kind: 'fixed', weight: 45 }, minReps: 10, maxReps: 10, amrap: false },
					{ setType: 'work', percentage: 0.85, weightBasis: { kind: 'crossReference', liftId: 'press' }, minReps: 5, maxReps: 8, amrap: false },
					{ setType: 'backoff', percentage: 0.7225, weightBasis: { kind: 'crossReference', liftId: 'press' }, minReps: 5, maxReps: 8, amrap: true },
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
		const results: SetResult[][] = [
			[
				{ actualWeight: 45, actualReps: 10, completed: true, actualSetType: 'warmup' },
				{ actualWeight: 95, actualReps: 5, completed: true, actualSetType: 'warmup' },
				{ actualWeight: 130, actualReps: 3, completed: true, actualSetType: 'warmup' },
				{ actualWeight: 170, actualReps: 2, completed: true, actualSetType: 'warmup' },
				{ actualWeight: 200, actualReps: 5, completed: true, actualSetType: 'work' },
				{ actualWeight: 170, actualReps: 8, completed: true, actualSetType: 'backoff' },
			],
			[
				{ actualWeight: 45, actualReps: 10, completed: true, actualSetType: 'warmup' },
				{ actualWeight: 120, actualReps: 8, completed: true, actualSetType: 'work' },
				{ actualWeight: 102.5, actualReps: 6, completed: true, actualSetType: 'backoff' },
			],
			[
				{ actualWeight: 60, actualReps: 8, completed: true, actualSetType: 'work' },
				{ actualWeight: 50, actualReps: 8, completed: true, actualSetType: 'backoff' },
			],
		];

		const proposals = computeProgression(exercises, results, configs, templates);

		// Should produce proposals for bench and skull-crusher only (press is secondary)
		expect(proposals).toHaveLength(2);

		const benchProposal = proposals.find((p) => p.liftId === 'bench');
		expect(benchProposal).toBeDefined();
		expect(benchProposal!.topSetHit).toBe(true);
		expect(benchProposal!.backoffHit).toBe(true);
		expect(benchProposal!.proposedTopSetWeight).toBe(202.5);
		expect(benchProposal!.proposedBackoffWeight).toBe(172.5);

		const skullProposal = proposals.find((p) => p.liftId === 'skull-crusher');
		expect(skullProposal).toBeDefined();
		expect(skullProposal!.topSetHit).toBe(true);
		expect(skullProposal!.backoffHit).toBe(true);
		expect(skullProposal!.proposedTopSetWeight).toBe(62.5);
		expect(skullProposal!.proposedBackoffWeight).toBe(53.5);

		// No proposal for press (it's a secondary exercise)
		expect(proposals.find((p) => p.liftId === 'press')).toBeUndefined();
	});
});
