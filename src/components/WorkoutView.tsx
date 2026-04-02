import { useState } from 'react';
import type { ComputedSet, SetResult, Workout } from '../model/index.js';

interface WorkoutViewProps {
	workout: Workout;
	onBack: () => void;
	onFinish: (workout: Workout, results: SetResult[][]) => void;
}

/**
 * Build a comment string that includes rep-range / AMRAP hints (when present)
 * merged with any existing set comment.
 */
function buildComment(set: ComputedSet): string | undefined {
	const parts: string[] = [];
	const hasRange = set.minReps !== set.maxReps;
	if (hasRange) {
		parts.push(`${set.minReps}–${set.maxReps} reps`);
	}
	if (set.amrap) {
		parts.push('AMRAP');
	}
	if (set.comment) {
		parts.push(set.comment);
	}
	return parts.length > 0 ? parts.join(' · ') : undefined;
}

/** Label for set type, with a visual class. */
function setTypeLabel(type: ComputedSet['setType']): string {
	switch (type) {
		case 'warmup':
			return 'Warm-up';
		case 'work':
			return 'Work';
		case 'backoff':
			return 'Backoff';
	}
}

function initResults(workout: Workout): SetResult[][] {
	return workout.exercises.map((ex) =>
		ex.sets.map((set) => ({
			actualWeight: set.weight,
			actualReps: set.minReps,
			completed: false,
		})),
	);
}

export function WorkoutView({ workout, onBack, onFinish }: WorkoutViewProps) {
	const [results, setResults] = useState<SetResult[][]>(() =>
		initResults(workout),
	);
	const [finished, setFinished] = useState(false);

	function updateSet(
		exerciseIdx: number,
		setIdx: number,
		patch: Partial<SetResult>,
	) {
		setResults((prev) =>
			prev.map((ex, ei) =>
				ei !== exerciseIdx
					? ex
					: ex.map((s, si) =>
							si !== setIdx ? s : { ...s, ...patch },
						),
			),
		);
	}

	const totalSets = results.flat().length;
	const completedSets = results.flat().filter((s) => s.completed).length;

	function handleFinish() {
		setFinished(true);
		onFinish(workout, results);
	}

	if (finished) {
		return (
			<div className="workout-view">
				<div className="finish-summary">
					<h2>Workout Complete!</h2>
					<p>
						{completedSets} of {totalSets} sets completed.
					</p>
					<p className="finish-note">
						Results have been saved to your Google Sheet.
					</p>
					<button className="btn-primary" onClick={onBack}>
						Back to Workouts
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="workout-view">
			<header className="workout-header">
				<button className="btn-back" onClick={onBack}>
					← Back
				</button>
				<h1 className="workout-title">{workout.name}</h1>
				<span className="progress-badge">
					{completedSets}/{totalSets}
				</span>
			</header>

			{workout.exercises.map((exercise, exerciseIdx) => (
				<section key={exerciseIdx} className="exercise-card">
					<h2 className="exercise-name">{exercise.name}</h2>
					<div className="sets-list">
						{exercise.sets.map((set, setIdx) => {
							const result = results[exerciseIdx][setIdx];
							return (
								<div
									key={setIdx}
									className={`set-row ${result.completed ? 'set-completed' : ''}`}
								>
									<label className="set-checkbox">
										<input
											type="checkbox"
											checked={result.completed}
											onChange={(e) =>
												updateSet(
													exerciseIdx,
													setIdx,
													{
														completed:
															e.target.checked,
													},
												)
											}
										/>
									</label>
									<span
										className={`set-type set-type-${set.setType}`}
									>
										{setTypeLabel(set.setType)}
									</span>
									<div className="set-fields">
										<label className="field-group">
											<span className="field-label">
												lbs
											</span>
											<input
												type="number"
												className="field-input"
												value={result.actualWeight}
												onChange={(e) =>
													updateSet(
														exerciseIdx,
														setIdx,
														{
															actualWeight:
																Number(
																	e.target
																		.value,
																) || 0,
														},
													)
												}
											/>
										</label>
										<span className="field-separator">
											×
										</span>
										<label className="field-group">
											<span className="field-label">
												reps
											</span>
											<input
												type="number"
												className="field-input"
												value={result.actualReps}
												onChange={(e) =>
													updateSet(
														exerciseIdx,
														setIdx,
														{
															actualReps:
																Number(
																	e.target
																		.value,
																) || 0,
														},
													)
												}
											/>
										</label>
									</div>
									{(() => {
										const comment = buildComment(set);
										return comment ? (
											<p className="set-comment">
												{comment}
											</p>
										) : null;
									})()}
								</div>
							);
						})}
					</div>
				</section>
			))}

			<div className="finish-bar">
				<button className="btn-finish" onClick={handleFinish}>
					Finish Workout
				</button>
			</div>
		</div>
	);
}
