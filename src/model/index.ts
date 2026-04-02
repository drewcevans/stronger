export type {
	ComputedExercise,
	ComputedSet,
	ExerciseTemplate,
	LiftConfig,
	PreviousSetData,
	ProgressionProposal,
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
	isSecondaryExercise,
} from './progression.js';
