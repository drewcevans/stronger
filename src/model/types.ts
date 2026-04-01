/**
 * Exercise data model types.
 *
 * Three-layer model:
 *   1. LiftConfig      – per-lift settings stored as editable cells in the Google Sheet
 *   2. SetTemplate /    – the ordered list of sets for an exercise, each with a set type,
 *      ExerciseTemplate   percentage, weight basis, rep range, and optional comment
 *   3. ComputedSet /    – a concrete workout instance with calculated weights
 *      ComputedExercise
 */

// ---------------------------------------------------------------------------
// Layer 1 – Lift configuration (Google Sheet "inputs" zone)
// ---------------------------------------------------------------------------

/**
 * Per-lift configuration that controls how weights are calculated and
 * progressed. Every field maps to an editable cell in the spreadsheet.
 */
export interface LiftConfig {
	/** Stable identifier for cross-referencing between lifts. */
	id: string;
	/** Human-readable name (e.g. "Bench Press"). */
	name: string;
	/** The reference weight for "top set" / work sets (lbs). */
	topSetWeight: number;
	/** The reference weight for backoff sets, tracked independently (lbs). */
	backoffWeight: number;
	/** Weight added on successful progression (e.g. 2.5 or 5 lbs). */
	increment: number;
	/** Floor — no set will be programmed below this weight (lbs). */
	minimumWeight: number;
	/** All calculated weights are rounded to the nearest multiple of this value. */
	roundingFactor: number;
}

// ---------------------------------------------------------------------------
// Layer 2 – Exercise / set templates
// ---------------------------------------------------------------------------

/** Categorises a set within a workout. */
export type SetType = 'warmup' | 'work' | 'backoff';

/**
 * Determines which reference weight the set's percentage is applied to.
 *
 * - `topSet`        → this lift's own top-set weight
 * - `backoff`       → this lift's own backoff weight
 * - `crossReference` → another lift's top-set weight (e.g. secondary press
 *                      derives from primary press)
 * - `fixed`         → an absolute weight, not percentage-based (e.g. empty
 *                      bar warmup at 45 lbs)
 */
export type WeightBasis =
	| { kind: 'topSet' }
	| { kind: 'backoff' }
	| { kind: 'crossReference'; liftId: string }
	| { kind: 'fixed'; weight: number };

/** A single set within an exercise template. */
export interface SetTemplate {
	/** warmup / work / backoff */
	setType: SetType;
	/**
	 * Fraction of the reference weight (0 – 1).
	 * Ignored when weightBasis is `fixed`.
	 */
	percentage: number;
	/** Which reference weight the percentage applies to. */
	weightBasis: WeightBasis;
	/** Minimum reps for this set. */
	minReps: number;
	/** Maximum reps for this set. Equal to minReps for fixed-rep sets. */
	maxReps: number;
	/** If true the lifter should perform as many reps as possible beyond minReps. */
	amrap: boolean;
	/** Optional note (e.g. progression rule) shown in the app. */
	comment?: string;
}

/**
 * The ordered list of sets for a single exercise in a workout.
 * Combined with a LiftConfig it fully determines every set weight.
 */
export interface ExerciseTemplate {
	/** References a LiftConfig.id — the lift whose config governs this exercise. */
	liftId: string;
	/** Display name (e.g. "Primary: Bench Press"). */
	name: string;
	/** Ordered set list. */
	sets: SetTemplate[];
}

// ---------------------------------------------------------------------------
// Layer 3 – Computed weekly instance
// ---------------------------------------------------------------------------

/** A concrete set with a calculated weight, ready for display or sheet output. */
export interface ComputedSet {
	setType: SetType;
	/** Calculated weight after percentage × reference → round → clamp. */
	weight: number;
	minReps: number;
	maxReps: number;
	amrap: boolean;
	comment?: string;
}

/** A fully computed exercise for a specific week. */
export interface ComputedExercise {
	/** References the originating LiftConfig.id. */
	liftId: string;
	/** Display name. */
	name: string;
	/** Ordered computed sets. */
	sets: ComputedSet[];
}
