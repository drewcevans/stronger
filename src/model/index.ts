export type {
	ActivityType,
	ComputedExercise,
	ComputedSet,
	ExerciseRole,
	ExerciseTemplate,
	LiftConfig,
	PreviousSetData,
	ProgressionProposal,
	ScheduleEntry,
	SetResult,
	SetTemplate,
	SetType,
	WeightBasis,
	Workout,
} from './types.js';

export {
	computeExercise,
	computeSet,
	computeSetWeight,
	computeWeight,
	roundToNearest,
} from './compute.js';

export {
	computeProgression,
	isCrossReferenceOnly,
} from './progression.js';
