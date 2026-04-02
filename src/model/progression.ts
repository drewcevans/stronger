/**
 * Post-workout weight progression logic.
 *
 * Evaluates completed set results against the programmed rep ranges and
 * proposes weight updates for each non-secondary lift in the workout.
 */

import type {
	ComputedExercise,
	ComputedSet,
	ExerciseTemplate,
	LiftConfig,
	ProgressionProposal,
	SetResult,
} from './types.js';

/**
 * Returns true if the exercise is "secondary" — i.e. all of its work/backoff
 * sets derive from another lift via crossReference weight basis.
 */
export function isSecondaryExercise(template: ExerciseTemplate): boolean {
	const relevantSets = template.sets.filter(
		(s) => s.setType === 'work' || s.setType === 'backoff',
	);
	if (relevantSets.length === 0) return false;
	return relevantSets.every((s) => s.weightBasis.kind === 'crossReference');
}

/**
 * Compute progression proposals for all non-secondary lifts in a completed workout.
 *
 * Groups exercises by liftId. For each lift, checks the most relevant
 * work set (topSet basis) and backoff set (backoff basis) to determine
 * whether the rep target was met. If met, proposes current weight + increment.
 *
 * @param exercises   – the computed exercises in the workout
 * @param results     – parallel array of SetResult arrays for each exercise
 * @param configs     – all lift configurations
 * @param templates   – the exercise templates (to check weight basis for secondary filtering)
 * @returns an array of ProgressionProposal, one per eligible liftId
 */
export function computeProgression(
	exercises: ComputedExercise[],
	results: SetResult[][],
	configs: LiftConfig[],
	templates: ExerciseTemplate[],
): ProgressionProposal[] {
	const configMap = new Map(configs.map((c) => [c.id, c]));

	// Track per-liftId: whether top-set and backoff targets were hit.
	// We use a Map so each liftId is surfaced only once.
	const liftSignals = new Map<
		string,
		{ topSetHit: boolean; backoffHit: boolean }
	>();

	for (let ei = 0; ei < exercises.length; ei++) {
		const exercise = exercises[ei];
		const template = templates[ei];
		if (!template || !exercise) continue;

		// Skip secondary exercises (crossReference-based)
		if (isSecondaryExercise(template)) continue;

		const liftId = exercise.liftId;
		if (!liftSignals.has(liftId)) {
			liftSignals.set(liftId, { topSetHit: false, backoffHit: false });
		}
		const signals = liftSignals.get(liftId)!;

		// Evaluate each set that is work or backoff
		for (let si = 0; si < exercise.sets.length; si++) {
			const set: ComputedSet = exercise.sets[si];
			const result: SetResult | undefined = results[ei]?.[si];
			const templateSet = template.sets[si];
			if (!result || !templateSet) continue;
			if (!result.completed) continue;

			const actualType = result.actualSetType;
			if (actualType !== 'work' && actualType !== 'backoff') continue;

			const hitTarget = result.actualReps >= set.maxReps;

			if (
				actualType === 'work' &&
				templateSet.weightBasis.kind === 'topSet'
			) {
				if (hitTarget) signals.topSetHit = true;
			} else if (
				actualType === 'backoff' &&
				templateSet.weightBasis.kind === 'backoff'
			) {
				if (hitTarget) signals.backoffHit = true;
			}
		}
	}

	// Build proposals from the aggregated signals
	const proposals: ProgressionProposal[] = [];
	for (const [liftId, signals] of liftSignals) {
		const config = configMap.get(liftId);
		if (!config) continue;

		proposals.push({
			liftId,
			liftName: config.name,
			currentTopSetWeight: config.topSetWeight,
			currentBackoffWeight: config.backoffWeight,
			proposedTopSetWeight: signals.topSetHit
				? config.topSetWeight + config.increment
				: config.topSetWeight,
			proposedBackoffWeight: signals.backoffHit
				? config.backoffWeight + config.increment
				: config.backoffWeight,
			increment: config.increment,
			topSetHit: signals.topSetHit,
			backoffHit: signals.backoffHit,
		});
	}

	return proposals;
}
