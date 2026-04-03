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
/** Equipment type for an exercise. */
export type GearType = 'barbell' | 'dumbbell' | 'band' | 'bodyweight' | 'other';

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
	/** Starting minimum — no set will be programmed below this weight (lbs). */
	minimumWeight: number;
	/** All calculated weights are rounded to the nearest multiple of this value. */
	roundingFactor: number;
	/** Minimum allowable weight for the exercise (e.g. empty bar = 45 lbs). */
	barWeight: number;
	/** Equipment type used for this exercise. */
	gear: GearType;
}

// ---------------------------------------------------------------------------
// Layer 2 – Exercise / set templates
// ---------------------------------------------------------------------------

/** Categorises a set within a workout. */
export type SetType = 'warmup' | 'work' | 'backoff' | 'joker';

/**
 * Determines which reference weight the set's percentage is applied to.
 *
 * - `topSet`        → this lift's own top-set weight
 * - `backoff`       → this lift's own backoff weight
 * - `crossReference` → another lift's top-set weight (e.g. secondary press
 *                      derives from primary press)
 * - `fixed`         → an absolute weight, not percentage-based (e.g. empty
 *                      bar warmup at 45 lbs)
 * - `barWeight`     → the lift's configured bar weight (minimum allowable
 *                      weight for the equipment)
 */
export type WeightBasis =
	| { kind: 'topSet' }
	| { kind: 'backoff' }
	| { kind: 'crossReference'; liftId: string }
	| { kind: 'fixed'; weight: number }
	| { kind: 'barWeight' };

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

// ---------------------------------------------------------------------------
// Layer 4 – Workout (named collection of exercises)
// ---------------------------------------------------------------------------

/** Broad category for an activity entry. */
export type ActivityType = 'strength' | 'cardio';

/** A named workout containing an ordered list of computed exercises. */
export interface Workout {
	/** Short identifier (e.g. "A", "B", "C", "D"). */
	id: string;
	/** Display name (e.g. "Workout A – Bench / Squat"). */
	name: string;
	/** Broad category — strength workouts have sets/reps, cardio entries do not. */
	category: ActivityType;
	/** Ordered list of exercises for this workout. */
	exercises: ComputedExercise[];
}

// ---------------------------------------------------------------------------
// Layer 5 – Execution state (tracking what the user actually does)
// ---------------------------------------------------------------------------

/** Previous-session data for a single set (read-only context). */
export interface PreviousSetData {
	/** The weight used in the previous session. */
	weight: number;
	/** The reps performed in the previous session. */
	reps: number;
}

/** Tracks the user's actual performance for a single set during workout execution. */
export interface SetResult {
	/** The weight actually used (pre-filled with planned weight). */
	actualWeight: number;
	/** The reps actually performed (pre-filled with planned minReps). */
	actualReps: number;
	/** Whether the user has marked this set as complete. */
	completed: boolean;
	/** The set type after any user override (pre-filled with planned setType). */
	actualSetType: SetType;
}

// ---------------------------------------------------------------------------
// Layer 6 – Schedule (day→workout mapping for calendar planning)
// ---------------------------------------------------------------------------

/** A single schedule entry mapping a date to a workout. */
export interface ScheduleEntry {
	/** Date in YYYY-MM-DD format. */
	date: string;
	/** References a Workout.id (e.g. "A", "B"). */
	workoutId: string;
}

// ---------------------------------------------------------------------------
// Layer 7 – Progression (post-workout weight update proposals)
// ---------------------------------------------------------------------------

/** A proposed weight change for a single lift after completing a workout. */
export interface ProgressionProposal {
	/** References the LiftConfig.id this proposal applies to. */
	liftId: string;
	/** Human-readable lift name. */
	liftName: string;
	/** Current top-set weight from the config. */
	currentTopSetWeight: number;
	/** Current backoff weight from the config. */
	currentBackoffWeight: number;
	/** Proposed new top-set weight after progression. */
	proposedTopSetWeight: number;
	/** Proposed new backoff weight after progression. */
	proposedBackoffWeight: number;
	/** The configured increment for this lift. */
	increment: number;
	/** Rounding factor for this lift's weights (used as step size for +/− buttons). */
	roundingFactor: number;
	/** Whether the top-set rep target was met or exceeded. */
	topSetHit: boolean;
	/** Whether the backoff rep target was met or exceeded. */
	backoffHit: boolean;
}
