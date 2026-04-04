import { useMemo, useState } from 'react';
import type { Workout } from '../model/index.js';
import { Banner } from './Banner.js';
import { LiftBadge } from './LiftBadge.js';
import { Activity, ChevronDown, Pencil, Plus, Star } from 'lucide-react';

interface WorkoutSelectProps {
	workouts: Workout[];
	missingLiftIds?: string[];
	onSelect: (workout: Workout) => void;
	onEdit?: (workoutId: string) => void;
	onNew?: () => void;
	onToggleFavorite?: (workoutId: string, favorite: boolean) => void;
}

function WorkoutCard({
	w,
	onSelect,
	onEdit,
	onToggleFavorite,
	cardio,
}: {
	w: Workout;
	onSelect: (w: Workout) => void;
	onEdit?: (id: string) => void;
	onToggleFavorite?: (id: string, fav: boolean) => void;
	cardio?: boolean;
}) {
	return (
		<div className="workout-card-wrapper">
			{onToggleFavorite && (
				<button
					className={`btn-fav-workout${w.favorite ? ' btn-fav-active' : ''}`}
					aria-label={w.favorite ? `Remove ${w.name} from favorites` : `Add ${w.name} to favorites`}
					onClick={() => onToggleFavorite(w.id, !w.favorite)}
				>
					<Star size={16} fill={w.favorite ? 'currentColor' : 'none'} />
				</button>
			)}
			<button
				className={`workout-card${cardio ? ' workout-card-cardio' : ''}`}
				onClick={() => onSelect(w)}
			>
				{/* TODO: re-enable once new neon-style icons are ready
				{cardio ? (
					<span className="cardio-badge"><Activity size={24} /></span>
				) : (
					<LiftBadge liftId={w.exercises[0]?.liftId ?? 'unknown'} size={48} />
				)}
				*/}
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
	);
}

export function WorkoutSelect({ workouts, missingLiftIds, onSelect, onEdit, onNew, onToggleFavorite }: WorkoutSelectProps) {
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

	const [moreOpen, setMoreOpen] = useState(false);

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
						<WorkoutCard key={w.id} w={w} onSelect={onSelect} onEdit={onEdit} onToggleFavorite={onToggleFavorite} />
					))}
					{others.length > 0 && (
						<>
							<button
								className="btn-more-toggle"
								onClick={() => setMoreOpen(!moreOpen)}
								aria-expanded={moreOpen}
							>
								More…
								<ChevronDown size={16} className={`more-chevron${moreOpen ? ' more-chevron-open' : ''}`} />
							</button>
							{moreOpen && others.map((w) => (
								<WorkoutCard key={w.id} w={w} onSelect={onSelect} onEdit={onEdit} onToggleFavorite={onToggleFavorite} />
							))}
						</>
					)}
					{cardio.length > 0 && (favorites.length > 0 || others.length > 0) && (
						<div className="category-divider">
							<span className="category-divider-label">Cardio</span>
						</div>
					)}
					{cardio.map((w) => (
						<WorkoutCard key={w.id} w={w} onSelect={onSelect} onEdit={onEdit} onToggleFavorite={onToggleFavorite} cardio />
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
