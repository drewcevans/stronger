import { useState, useCallback, useMemo } from 'react';
import type { LiftConfig, GearType } from '../model/index.js';
import { ArrowLeft } from 'lucide-react';
import { nameToId, DEFAULT_STRENGTH_CONFIG, isCardioExercise } from './ExerciseLibrary.js';

const GEAR_OPTIONS: GearType[] = ['barbell', 'dumbbell', 'band', 'bodyweight', 'other'];

interface ExerciseEditorProps {
	existing?: LiftConfig;
	allConfigs: LiftConfig[];
	onSave: (config: LiftConfig) => void;
	onCancel: () => void;
}

export function ExerciseEditor({ existing, allConfigs, onSave, onCancel }: ExerciseEditorProps) {
	const isNew = !existing;
	const isCardio = existing ? isCardioExercise(existing) : false;

	const [name, setName] = useState(existing?.name ?? '');
	const [exerciseType, setExerciseType] = useState<'strength' | 'cardio'>(
		isCardio ? 'cardio' : 'strength',
	);
	const [topSetWeight, setTopSetWeight] = useState(existing?.topSetWeight ?? DEFAULT_STRENGTH_CONFIG.topSetWeight);
	const [backoffWeight, setBackoffWeight] = useState(existing?.backoffWeight ?? DEFAULT_STRENGTH_CONFIG.backoffWeight);
	const [increment, setIncrement] = useState(existing?.increment ?? DEFAULT_STRENGTH_CONFIG.increment);
	const [minimumWeight, setMinimumWeight] = useState(existing?.minimumWeight ?? DEFAULT_STRENGTH_CONFIG.minimumWeight);
	const [roundingFactor, setRoundingFactor] = useState(existing?.roundingFactor ?? DEFAULT_STRENGTH_CONFIG.roundingFactor);
	const [barWeight, setBarWeight] = useState(existing?.barWeight ?? DEFAULT_STRENGTH_CONFIG.barWeight);
	const [gear, setGear] = useState<GearType>(existing?.gear ?? DEFAULT_STRENGTH_CONFIG.gear);
	const [saving, setSaving] = useState(false);

	const autoId = nameToId(name);
	const effectiveId = existing?.id ?? autoId;

	const nameConflict = useMemo(() => {
		if (!isNew) return false;
		return allConfigs.some((c) => c.id === autoId);
	}, [isNew, allConfigs, autoId]);

	const isValid = name.trim().length > 0 && !nameConflict;

	const handleSave = useCallback(() => {
		if (!isValid || saving) return;
		setSaving(true);

		const config: LiftConfig = exerciseType === 'cardio'
			? {
				id: effectiveId,
				name: name.trim(),
				topSetWeight: 0,
				backoffWeight: 0,
				increment: 0,
				minimumWeight: 0,
				roundingFactor: 0,
				barWeight: 0,
				gear: 'bodyweight',
			}
			: {
				id: effectiveId,
				name: name.trim(),
				topSetWeight,
				backoffWeight,
				increment,
				minimumWeight,
				roundingFactor,
				barWeight,
				gear,
			};
		onSave(config);
	}, [isValid, saving, effectiveId, name, exerciseType, topSetWeight, backoffWeight, increment, minimumWeight, roundingFactor, barWeight, gear, onSave]);

	const showWeightFields = exerciseType === 'strength' && !isCardio;

	return (
		<div className="exercise-editor">
			<header className="workout-header">
				<button className="btn-back" onClick={onCancel}>
					<ArrowLeft size={20} /> Cancel
				</button>
				<h1 className="workout-title">
					{isNew ? 'New Exercise' : `Edit ${existing?.name ?? ''}`}
				</h1>
				<button
					className="btn-finish"
					disabled={!isValid || saving}
					onClick={handleSave}
				>
					{saving ? 'Saving…' : 'Save'}
				</button>
			</header>

			<div className="exercise-editor-form">
				{/* Name */}
				<label className="editor-field">
					<span className="editor-label">Name</span>
					<input
						className="editor-input"
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="e.g. Bench Press"
						disabled={!isNew}
						autoFocus={isNew}
					/>
					{nameConflict && (
						<span className="editor-error">An exercise with this name already exists</span>
					)}
				</label>

				{/* Type selector (only for new exercises) */}
				{isNew && (
					<div className="editor-field">
						<span className="editor-label">Type</span>
						<div className="editor-type-toggle">
							<button
								className={`editor-type-btn${exerciseType === 'strength' ? ' editor-type-active' : ''}`}
								onClick={() => setExerciseType('strength')}
								type="button"
							>
								Strength
							</button>
							<button
								className={`editor-type-btn${exerciseType === 'cardio' ? ' editor-type-active' : ''}`}
								onClick={() => setExerciseType('cardio')}
								type="button"
							>
								Cardio
							</button>
						</div>
					</div>
				)}

				{/* Weight parameters (strength only) */}
				{showWeightFields && (
					<>
						<label className="editor-field">
							<span className="editor-label">Top Set Weight (lbs)</span>
							<input
								className="editor-input"
								type="number"
								min="0"
								step="any"
								value={topSetWeight}
								onChange={(e) => setTopSetWeight(Number(e.target.value) || 0)}
							/>
						</label>

						<label className="editor-field">
							<span className="editor-label">Backoff Weight (lbs)</span>
							<input
								className="editor-input"
								type="number"
								min="0"
								step="any"
								value={backoffWeight}
								onChange={(e) => setBackoffWeight(Number(e.target.value) || 0)}
							/>
						</label>

						<label className="editor-field">
							<span className="editor-label">Increment (lbs)</span>
							<input
								className="editor-input"
								type="number"
								min="0"
								step="any"
								value={increment}
								onChange={(e) => setIncrement(Number(e.target.value) || 0)}
							/>
						</label>

						<label className="editor-field">
							<span className="editor-label">Minimum Weight (lbs)</span>
							<input
								className="editor-input"
								type="number"
								min="0"
								step="any"
								value={minimumWeight}
								onChange={(e) => setMinimumWeight(Number(e.target.value) || 0)}
							/>
						</label>

						<label className="editor-field">
							<span className="editor-label">Rounding Factor</span>
							<input
								className="editor-input"
								type="number"
								min="0"
								step="any"
								value={roundingFactor}
								onChange={(e) => setRoundingFactor(Number(e.target.value) || 0)}
							/>
						</label>

						<label className="editor-field">
							<span className="editor-label">Bar Weight (lbs)</span>
							<input
								className="editor-input"
								type="number"
								min="0"
								step="any"
								value={barWeight}
								onChange={(e) => setBarWeight(Number(e.target.value) || 0)}
							/>
						</label>

						<div className="editor-field">
							<span className="editor-label">Gear Type</span>
							<select
								className="editor-select"
								value={gear}
								onChange={(e) => setGear(e.target.value as GearType)}
							>
								{GEAR_OPTIONS.map((g) => (
									<option key={g} value={g}>
										{g.charAt(0).toUpperCase() + g.slice(1)}
									</option>
								))}
							</select>
						</div>
					</>
				)}

				{/* Cardio info (existing cardio exercises) */}
				{!isNew && isCardio && (
					<p className="editor-hint">
						Cardio exercises have no weight parameters to edit.
					</p>
				)}
			</div>
		</div>
	);
}
