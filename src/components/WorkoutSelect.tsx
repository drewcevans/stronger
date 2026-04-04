import { useMemo, useState } from 'react';
import type { Workout } from '../model/index.js';
import { Banner } from './Banner.js';
import { LiftBadge } from './LiftBadge.js';
import { Activity, Pencil, Plus } from 'lucide-react';

interface WorkoutSelectProps {
	workouts: Workout[];
	missingLiftIds?: string[];
	onSelect: (workout: Workout) => void;
	onEdit?: (workoutId: string) => void;
	onNew?: () => void;
}

export function WorkoutSelect({ workouts, missingLiftIds, onSelect, onEdit, onNew }: WorkoutSelectProps) {
	const { favorites, others, cardio } = useMemo(() => {
		const favorites: Workout[] = [];
		const others: Workout[] = [];
		const cardio: Workout[] = [];
		for (const w of workouts) {
			if (w.category === 'cardio') cardio.push(w);
			else if (w.favorite) favorites.push(w);
			else others.push(w);
		}
		return { favorites, others, cardio };
	}, [workouts]);

	const [moreId, setMoreId] = useState('');

	return (
		<div className="workout-select">
			<Banner />
			{workouts.length === 0 ? (
				<p className="auth-error">
					No workouts available. Check that your sheet has valid lift
					configurations with numeric values for all weight fields.
				</p>
			) : (
				<div className="workout-list">
					{favorites.map((w) => (
						<div key={w.id} className="workout-card-wrapper">
							<button
								className="workout-card"
								onClick={() => onSelect(w)}
							>
								<LiftBadge liftId={w.exercises[0]?.liftId ?? 'unknown'} size={48} />
								<span className="workout-name">{w.name}</span>
							</button>
							{onEdit && (
								<button
									className="btn-edit-workout"
									aria-label={`Edit ${w.name}`}
									onClick={() => onEdit(w.id)}
								>
									<Pencil size={16} />
								</button>
							)}
						</div>
					))}
					{others.length > 0 && (
						<select
							className="workout-more-select"
							value={moreId}
							onChange={(e) => {
								const w = others.find((o) => o.id === e.target.value);
								if (w) {
									onSelect(w);
									setMoreId('');
								}
							}}
						>
							<option value="">More…</option>
							{others.map((w) => (
								<option key={w.id} value={w.id}>{w.name}</option>
							))}
						</select>
					)}
					{cardio.length > 0 && (favorites.length > 0 || others.length > 0) && (
						<div className="category-divider">
							<span className="category-divider-label">Cardio</span>
						</div>
					)}
					{cardio.map((w) => (
						<div key={w.id} className="workout-card-wrapper">
							<button
								className="workout-card workout-card-cardio"
								onClick={() => onSelect(w)}
							>
								<span className="cardio-badge">
									<Activity size={24} />
								</span>
								<span className="workout-name">{w.name}</span>
							</button>
							{onEdit && (
								<button
									className="btn-edit-workout"
									aria-label={`Edit ${w.name}`}
									onClick={() => onEdit(w.id)}
								>
									<Pencil size={16} />
								</button>
							)}
						</div>
					))}
					{onNew && (
						<button className="btn-new-workout" onClick={onNew}>
							<Plus size={20} /> New Workout
						</button>
					)}
				</div>
			)}
			{missingLiftIds && missingLiftIds.length > 0 && (
				<p className="config-warning">
					Missing lift configs: {missingLiftIds.join(', ')}
				</p>
			)}
		</div>
	);
}
