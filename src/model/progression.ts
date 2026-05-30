/**
 * Post-workout weight progression logic.
 *
 * Evaluates completed set results against the programmed rep ranges and
 * proposes weight updates for each eligible lift in the workout.
 * Exercises whose work/backoff sets all use crossReference weight basis
 * are excluded — their weights are derived from another lift's config.
 */

import type {
	ComputedExercise,
	ComputedSet,
	ExerciseTemplate,
	LiftConfig,
	ProgressionProposal,
	SetResult,
} from './types.js';
import { roundToNearest } from './compute.js';

/**
 * Returns true if all work/backoff sets in the exercise use crossReference
 * weight basis. These exercises derive their weights from another lift's
 * config and should not be independently progressed.
 */
export function isCrossReferenceOnly(template: ExerciseTemplate): boolean {
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

	// Track the actual weight used on the highest-percentage completed set for
	// each lift so we can derive the effective reference weight from what the
	// user really lifted (not the planned config value).
	const actualTopRef = new Map<
		string,
		{ actualWeight: number; percentage: number }
	>();
	const actualBackoffRef = new Map<
		string,
		{ actualWeight: number; percentage: number }
	>();

	for (let ei = 0; ei < exercises.length; ei++) {
		const exercise = exercises[ei];
		const template = templates[ei];
		if (!template || !exercise) continue;

		// Skip exercises where all work/backoff sets use crossReference —
		// their weights are derived from another lift's config.
		if (isCrossReferenceOnly(template)) continue;

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
				// Only suggest incrementing if the set is at 100% of the top-set
				// weight. Sub-100% sets (e.g. easy/hypertrophy days) should not
				// trigger a weight increase.
				if (hitTarget && templateSet.percentage >= 1.0)
					signals.topSetHit = true;
				// Prefer the highest-percentage set for back-calculating the reference
				const prev = actualTopRef.get(liftId);
				if (!prev || templateSet.percentage > prev.percentage) {
					actualTopRef.set(liftId, {
						actualWeight: result.actualWeight,
						percentage: templateSet.percentage,
					});
				}
			} else if (
				actualType === 'backoff' &&
				templateSet.weightBasis.kind === 'backoff'
			) {
				// Only suggest incrementing backoff if the set is at 100% of the
				// backoff weight.
				if (hitTarget && templateSet.percentage >= 1.0)
					signals.backoffHit = true;
				const prev = actualBackoffRef.get(liftId);
				if (!prev || templateSet.percentage > prev.percentage) {
					actualBackoffRef.set(liftId, {
						actualWeight: result.actualWeight,
						percentage: templateSet.percentage,
					});
				}
			}
		}
	}

	// Build proposals from the aggregated signals
	const proposals: ProgressionProposal[] = [];
	for (const [liftId, signals] of liftSignals) {
		const config = configMap.get(liftId);
		if (!config) continue;

		// Derive the effective reference weight from the actual weight the user
		// completed, back-calculating through the set's percentage.  Falls back
		// to the config value when no completed set was tracked (e.g. all sets
		// were skipped / incomplete).
		const topRef = actualTopRef.get(liftId);
		const effectiveTopSetWeight =
			topRef && topRef.percentage > 0
				? roundToNearest(
						topRef.actualWeight / topRef.percentage,
						config.roundingFactor,
					)
				: config.topSetWeight;

		const backRef = actualBackoffRef.get(liftId);
		const effectiveBackoffWeight =
			backRef && backRef.percentage > 0
				? roundToNearest(
						backRef.actualWeight / backRef.percentage,
						config.roundingFactor,
					)
				: config.backoffWeight;

		proposals.push({
			liftId,
			liftName: config.name,
			currentTopSetWeight: effectiveTopSetWeight,
			currentBackoffWeight: effectiveBackoffWeight,
			proposedTopSetWeight: signals.topSetHit
				? effectiveTopSetWeight + config.increment
				: effectiveTopSetWeight,
			proposedBackoffWeight: signals.backoffHit
				? effectiveBackoffWeight + config.increment
				: effectiveBackoffWeight,
			increment: config.increment,
			roundingFactor: config.roundingFactor,
			topSetHit: signals.topSetHit,
			backoffHit: signals.backoffHit,
		});
	}

	return proposals;
}
