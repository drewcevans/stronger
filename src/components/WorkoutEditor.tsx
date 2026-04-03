import { useState, useCallback, useMemo } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import type { SetTemplate, WeightBasis, SetType, LiftConfig } from '../model/index.js';
import type { WorkoutDefinition } from '../data/sample-workouts.js';
import type { ActivityType } from '../model/types.js';

/** Valid exercise roles within a workout definition. */
type ExerciseRole = 'primary' | 'secondary' | 'assistance';

/** Local state for an exercise being edited. */
interface EditableExercise {
	liftId: string;
	role: ExerciseRole;
	sets: SetTemplate[];
}

/** Local state for a workout being edited. */
interface EditableWorkout {
	id: string;
	name: string;
	category: ActivityType;
	exercises: EditableExercise[];
}

interface WorkoutEditorProps {
	/** Existing definition to edit, or undefined for a new workout. */
	existing?: WorkoutDefinition;
	/** All current definitions (used for ID uniqueness checks). */
	allDefinitions: WorkoutDefinition[];
	/** Available lifts from configs. */
	configs: LiftConfig[];
	onSave: (definition: WorkoutDefinition) => void;
	onCancel: () => void;
}

const SET_TYPES: SetType[] = ['warmup', 'work', 'backoff', 'joker'];
const ROLES: ExerciseRole[] = ['primary', 'secondary', 'assistance'];

function setTypeLabel(type: SetType): string {
	switch (type) {
		case 'warmup': return 'Warm-up';
		case 'work': return 'Work';
		case 'backoff': return 'Backoff';
		case 'joker': return 'Joker';
	}
}

function roleLabel(role: ExerciseRole): string {
	switch (role) {
		case 'primary': return 'Primary';
		case 'secondary': return 'Secondary';
		case 'assistance': return 'Assistance';
	}
}

/** Infer the exercise role from the display name prefix. */
function inferRole(name: string): ExerciseRole {
	const lower = name.toLowerCase();
	if (lower.startsWith('primary')) return 'primary';
	if (lower.startsWith('secondary')) return 'secondary';
	return 'assistance';
}

/** Generate a kebab-case ID from a workout name. */
function nameToId(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

/** Default set template for newly added sets. */
function defaultSet(): SetTemplate {
	return {
		setType: 'work',
		percentage: 1.0,
		weightBasis: { kind: 'topSet' },
		minReps: 5,
		maxReps: 5,
		amrap: false,
	};
}

/** Convert a WorkoutDefinition to the local editable format. */
function toEditable(def: WorkoutDefinition): EditableWorkout {
	return {
		id: def.id,
		name: def.name,
		category: def.category ?? 'strength',
		exercises: def.templates.map((t) => ({
			liftId: t.liftId,
			role: inferRole(t.name),
			sets: t.sets.map((s) => ({ ...s })),
		})),
	};
}

/** Convert the local editable format back to a WorkoutDefinition. */
function fromEditable(e: EditableWorkout, configs: LiftConfig[]): WorkoutDefinition {
	const liftMap = new Map(configs.map((c) => [c.id, c.name]));
	return {
		id: e.id,
		name: e.name,
		category: e.category,
		templates: e.exercises.map((ex) => {
			const liftName = liftMap.get(ex.liftId) ?? ex.liftId;
			const label = roleLabel(ex.role);
			return {
				liftId: ex.liftId,
				name: `${label}: ${liftName}`,
				sets: ex.sets,
			};
		}),
	};
}

export function WorkoutEditor({
	existing,
	allDefinitions,
	configs,
	onSave,
	onCancel,
}: WorkoutEditorProps) {
	const [workout, setWorkout] = useState<EditableWorkout>(() =>
		existing
			? toEditable(existing)
			: {
					id: '',
					name: '',
					category: 'strength',
					exercises: [],
				},
	);
	const [saving, setSaving] = useState(false);

	const isNew = !existing;

	// Available lifts sorted by name
	const lifts = useMemo(
		() => [...configs].sort((a, b) => a.name.localeCompare(b.name)),
		[configs],
	);

	// IDs already used by other definitions (excluding current if editing)
	const usedIds = useMemo(() => {
		const ids = new Set(allDefinitions.map((d) => d.id));
		if (existing) ids.delete(existing.id);
		return ids;
	}, [allDefinitions, existing]);

	// Validation
	const autoId = nameToId(workout.name);
	const effectiveId = isNew ? (workout.id || autoId) : workout.id;
	const errors: string[] = [];
	if (!workout.name.trim()) errors.push('Workout name is required');
	if (!effectiveId) errors.push('Workout ID is required');
	if (isNew && usedIds.has(effectiveId)) errors.push(`ID "${effectiveId}" is already in use`);
	if (workout.category === 'strength') {
		if (workout.exercises.length === 0) errors.push('Add at least one exercise');
		for (let i = 0; i < workout.exercises.length; i++) {
			const ex = workout.exercises[i];
			if (!ex.liftId) errors.push(`Exercise ${i + 1}: select a lift`);
			if (ex.sets.length === 0) errors.push(`Exercise ${i + 1}: add at least one set`);
		}
	}
	const isValid = errors.length === 0;

	// --- Workout-level updates ---
	const updateName = useCallback((name: string) => {
		setWorkout((prev) => ({ ...prev, name }));
	}, []);

	const updateId = useCallback((id: string) => {
		setWorkout((prev) => ({ ...prev, id }));
	}, []);

	const updateCategory = useCallback((category: ActivityType) => {
		setWorkout((prev) => ({ ...prev, category }));
	}, []);

	// --- Exercise-level updates ---
	const addExercise = useCallback(() => {
		setWorkout((prev) => ({
			...prev,
			exercises: [
				...prev.exercises,
				{ liftId: lifts[0]?.id ?? '', role: 'assistance', sets: [defaultSet()] },
			],
		}));
	}, [lifts]);

	const removeExercise = useCallback((idx: number) => {
		setWorkout((prev) => ({
			...prev,
			exercises: prev.exercises.filter((_, i) => i !== idx),
		}));
	}, []);

	const updateExercise = useCallback(
		(idx: number, patch: Partial<EditableExercise>) => {
			setWorkout((prev) => ({
				...prev,
				exercises: prev.exercises.map((ex, i) =>
					i === idx ? { ...ex, ...patch } : ex,
				),
			}));
		},
		[],
	);

	// --- Set-level updates ---
	const addSet = useCallback((exerciseIdx: number) => {
		setWorkout((prev) => ({
			...prev,
			exercises: prev.exercises.map((ex, i) => {
				if (i !== exerciseIdx) return ex;
				const last = ex.sets[ex.sets.length - 1];
				return {
					...ex,
					sets: [...ex.sets, last ? { ...last } : defaultSet()],
				};
			}),
		}));
	}, []);

	const removeSet = useCallback((exerciseIdx: number, setIdx: number) => {
		setWorkout((prev) => ({
			...prev,
			exercises: prev.exercises.map((ex, i) => {
				if (i !== exerciseIdx) return ex;
				return {
					...ex,
					sets: ex.sets.filter((_, si) => si !== setIdx),
				};
			}),
		}));
	}, []);

	const updateSet = useCallback(
		(exerciseIdx: number, setIdx: number, patch: Partial<SetTemplate>) => {
			setWorkout((prev) => ({
				...prev,
				exercises: prev.exercises.map((ex, ei) => {
					if (ei !== exerciseIdx) return ex;
					return {
						...ex,
						sets: ex.sets.map((s, si) =>
							si === setIdx ? { ...s, ...patch } : s,
						),
					};
				}),
			}));
		},
		[],
	);

	const updateWeightBasis = useCallback(
		(exerciseIdx: number, setIdx: number, kind: string, extraValue?: string) => {
			let wb: WeightBasis;
			switch (kind) {
				case 'backoff':
					wb = { kind: 'backoff' };
					break;
				case 'crossReference':
					wb = { kind: 'crossReference', liftId: extraValue ?? lifts[0]?.id ?? '' };
					break;
				case 'fixed':
					wb = { kind: 'fixed', weight: Number(extraValue) || 0 };
					break;
				default:
					wb = { kind: 'topSet' };
					break;
			}
			updateSet(exerciseIdx, setIdx, { weightBasis: wb });
		},
		[lifts, updateSet],
	);

	// --- Save ---
	const handleSave = useCallback(() => {
		if (!isValid || saving) return;
		setSaving(true);
		const def = fromEditable(
			{ ...workout, id: effectiveId },
			configs,
		);
		onSave(def);
	}, [isValid, saving, workout, effectiveId, configs, onSave]);

	return (
		<div className="workout-editor">
			<header className="workout-header">
				<button className="btn-back" onClick={onCancel}>
					<ArrowLeft size={20} /> Cancel
				</button>
				<h1 className="workout-title">
					{isNew ? 'New Workout' : 'Edit Workout'}
				</h1>
				<button
					className="btn-finish"
					disabled={!isValid || saving}
					onClick={handleSave}
				>
					{saving ? 'Saving…' : 'Save'}
				</button>
			</header>

			{/* Workout metadata */}
			<section className="editor-section">
				<label className="editor-field">
					<span className="editor-field-label">Workout Name</span>
					<input
						type="text"
						className="editor-text-input"
						value={workout.name}
						placeholder="e.g. Workout A — Bench / Press"
						onChange={(e) => updateName(e.target.value)}
					/>
				</label>
				{isNew && (
					<label className="editor-field">
						<span className="editor-field-label">
							ID <span className="editor-field-hint">{autoId ? `(auto: ${autoId})` : ''}</span>
						</span>
						<input
							type="text"
							className="editor-text-input editor-id-input"
							value={workout.id}
							placeholder={autoId || 'auto-generated from name'}
							onChange={(e) => updateId(e.target.value)}
						/>
					</label>
				)}
				<label className="editor-field">
					<span className="editor-field-label">Category</span>
					<select
						className="editor-select"
						value={workout.category}
						onChange={(e) => updateCategory(e.target.value as ActivityType)}
					>
						<option value="strength">Strength</option>
						<option value="cardio">Cardio</option>
					</select>
				</label>
			</section>

			{/* Exercises */}
			{workout.category === 'strength' && (
				<>
					{workout.exercises.map((exercise, exerciseIdx) => (
						<section key={exerciseIdx} className="editor-exercise">
							<div className="editor-exercise-header">
								<span className="editor-exercise-number">
									Exercise {exerciseIdx + 1}
								</span>
								<button
									type="button"
									className="btn-remove-exercise"
									aria-label="Remove exercise"
									onClick={() => removeExercise(exerciseIdx)}
								>
									<Trash2 size={16} />
								</button>
							</div>
							<div className="editor-exercise-meta">
								<label className="editor-field editor-field-inline">
									<span className="editor-field-label">Lift</span>
									<select
										className="editor-select"
										value={exercise.liftId}
										onChange={(e) =>
											updateExercise(exerciseIdx, { liftId: e.target.value })
										}
									>
										{!exercise.liftId && <option value="">Select…</option>}
										{lifts.map((l) => (
											<option key={l.id} value={l.id}>
												{l.name}
											</option>
										))}
									</select>
								</label>
								<label className="editor-field editor-field-inline">
									<span className="editor-field-label">Role</span>
									<select
										className="editor-select"
										value={exercise.role}
										onChange={(e) =>
											updateExercise(exerciseIdx, {
												role: e.target.value as ExerciseRole,
											})
										}
									>
										{ROLES.map((r) => (
											<option key={r} value={r}>
												{roleLabel(r)}
											</option>
										))}
									</select>
								</label>
							</div>

							{/* Sets */}
							<div className="editor-sets">
								<div className="editor-sets-header">
									<span className="editor-col-type">Type</span>
									<span className="editor-col-pct">%</span>
									<span className="editor-col-basis">Basis</span>
									<span className="editor-col-reps">Min</span>
									<span className="editor-col-reps">Max</span>
									<span className="editor-col-amrap">AMRAP</span>
									<span className="editor-col-remove"></span>
								</div>
								{exercise.sets.map((set, setIdx) => (
									<div key={setIdx} className="editor-set-row">
										<select
											className={`editor-set-type set-type-select set-type-${set.setType}`}
											value={set.setType}
											onChange={(e) =>
												updateSet(exerciseIdx, setIdx, {
													setType: e.target.value as SetType,
												})
											}
										>
											{SET_TYPES.map((t) => (
												<option key={t} value={t}>
													{setTypeLabel(t)}
												</option>
											))}
										</select>
										<input
											type="number"
											className="editor-pct-input"
											value={Math.round(set.percentage * 100)}
											min={0}
											max={200}
											onChange={(e) =>
												updateSet(exerciseIdx, setIdx, {
													percentage: (Number(e.target.value) || 0) / 100,
												})
											}
										/>
										<div className="editor-basis-group">
											<select
												className="editor-basis-select"
												value={set.weightBasis.kind}
												onChange={(e) =>
													updateWeightBasis(
														exerciseIdx,
														setIdx,
														e.target.value,
														set.weightBasis.kind === 'crossReference'
															? (set.weightBasis as { liftId: string }).liftId
															: set.weightBasis.kind === 'fixed'
																? String((set.weightBasis as { weight: number }).weight)
																: undefined,
													)
												}
											>
												<option value="topSet">Top set</option>
												<option value="backoff">Backoff</option>
												<option value="crossReference">Cross-ref</option>
												<option value="fixed">Fixed</option>
											</select>
											{set.weightBasis.kind === 'crossReference' && (
												<select
													className="editor-basis-extra"
													value={set.weightBasis.liftId}
													onChange={(e) =>
														updateWeightBasis(
															exerciseIdx,
															setIdx,
															'crossReference',
															e.target.value,
														)
													}
												>
													{lifts.map((l) => (
														<option key={l.id} value={l.id}>
															{l.name}
														</option>
													))}
												</select>
											)}
											{set.weightBasis.kind === 'fixed' && (
												<input
													type="number"
													className="editor-basis-extra-input"
													value={set.weightBasis.weight}
													placeholder="lbs"
													min={0}
													onChange={(e) =>
														updateWeightBasis(
															exerciseIdx,
															setIdx,
															'fixed',
															e.target.value,
														)
													}
												/>
											)}
										</div>
										<input
											type="number"
											className="editor-rep-input"
											value={set.minReps}
											min={0}
											onChange={(e) =>
												updateSet(exerciseIdx, setIdx, {
													minReps: Number(e.target.value) || 0,
												})
											}
										/>
										<input
											type="number"
											className="editor-rep-input"
											value={set.maxReps}
											min={0}
											onChange={(e) =>
												updateSet(exerciseIdx, setIdx, {
													maxReps: Number(e.target.value) || 0,
												})
											}
										/>
										<label className="editor-amrap-check">
											<input
												type="checkbox"
												checked={set.amrap}
												onChange={(e) =>
													updateSet(exerciseIdx, setIdx, {
														amrap: e.target.checked,
													})
												}
											/>
										</label>
										<button
											type="button"
											className="btn-remove-set"
											aria-label="Remove set"
											onClick={() => removeSet(exerciseIdx, setIdx)}
										>
											<Trash2 size={14} />
										</button>
									</div>
								))}
								<button
									type="button"
									className="btn-add-set"
									onClick={() => addSet(exerciseIdx)}
								>
									<Plus size={16} /> Add Set
								</button>
							</div>
						</section>
					))}

					<button
						type="button"
						className="btn-add-exercise"
						onClick={addExercise}
					>
						<Plus size={20} /> Add Exercise
					</button>
				</>
			)}

			{/* Validation errors */}
			{errors.length > 0 && (
				<div className="editor-errors">
					{errors.map((err, i) => (
						<p key={i} className="editor-error">{err}</p>
					))}
				</div>
			)}
		</div>
	);
}

// Re-export for use in App.tsx
export type { EditableExercise };
