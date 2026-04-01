import type {
	ComputedExercise,
	ComputedSet,
	ExerciseTemplate,
	LiftConfig,
	SetTemplate,
} from './types.js';

// ---------------------------------------------------------------------------
// Weight calculation helpers
// ---------------------------------------------------------------------------

/**
 * Round `value` to the nearest multiple of `factor`.
 * Uses standard "round half up" behaviour.
 */
export function roundToNearest(value: number, factor: number): number {
	if (factor <= 0) return value;
	return Math.round(value / factor) * factor;
}

/**
 * Core weight formula: percentage × referenceWeight → round → clamp to min.
 */
export function computeWeight(
	percentage: number,
	referenceWeight: number,
	roundingFactor: number,
	minimumWeight: number,
): number {
	const raw = percentage * referenceWeight;
	const rounded = roundToNearest(raw, roundingFactor);
	return Math.max(rounded, minimumWeight);
}

// ---------------------------------------------------------------------------
// Set / exercise computation
// ---------------------------------------------------------------------------

/**
 * Resolve the reference weight for a single set.
 *
 * @param set          – the set template to resolve
 * @param liftConfig   – the owning lift's configuration
 * @param allConfigs   – lookup map for cross-references
 * @returns the fully calculated weight for this set
 * @throws if a cross-referenced lift is not found in `allConfigs`
 */
export function computeSetWeight(
	set: SetTemplate,
	liftConfig: LiftConfig,
	allConfigs: ReadonlyMap<string, LiftConfig>,
): number {
	switch (set.weightBasis.kind) {
		case 'fixed':
			return set.weightBasis.weight;

		case 'topSet':
			return computeWeight(
				set.percentage,
				liftConfig.topSetWeight,
				liftConfig.roundingFactor,
				liftConfig.minimumWeight,
			);

		case 'backoff':
			return computeWeight(
				set.percentage,
				liftConfig.backoffWeight,
				liftConfig.roundingFactor,
				liftConfig.minimumWeight,
			);

		case 'crossReference': {
			const ref = allConfigs.get(set.weightBasis.liftId);
			if (!ref) {
				throw new Error(
					`Cross-reference lift "${set.weightBasis.liftId}" not found`,
				);
			}
			return computeWeight(
				set.percentage,
				ref.topSetWeight,
				liftConfig.roundingFactor,
				liftConfig.minimumWeight,
			);
		}
	}
}

/**
 * Produce a {@link ComputedSet} from a template.
 */
export function computeSet(
	set: SetTemplate,
	liftConfig: LiftConfig,
	allConfigs: ReadonlyMap<string, LiftConfig>,
): ComputedSet {
	return {
		setType: set.setType,
		weight: computeSetWeight(set, liftConfig, allConfigs),
		minReps: set.minReps,
		maxReps: set.maxReps,
		amrap: set.amrap,
		...(set.comment !== undefined && { comment: set.comment }),
	};
}

/**
 * Compute every set weight for an exercise, producing a week-ready instance.
 *
 * @param template   – the exercise template (set list + lift reference)
 * @param allConfigs – all lift configs keyed by id
 * @returns a {@link ComputedExercise} with concrete weights
 * @throws if the template's liftId is not found in `allConfigs`
 */
export function computeExercise(
	template: ExerciseTemplate,
	allConfigs: ReadonlyMap<string, LiftConfig>,
): ComputedExercise {
	const liftConfig = allConfigs.get(template.liftId);
	if (!liftConfig) {
		throw new Error(`Lift "${template.liftId}" not found in configs`);
	}

	return {
		liftId: template.liftId,
		name: template.name,
		sets: template.sets.map((s) => computeSet(s, liftConfig, allConfigs)),
	};
}
