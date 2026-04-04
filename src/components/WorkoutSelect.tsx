import { useMemo, useState } from 'react';
import type { Workout, ScheduleEntry } from '../model/index.js';
import type { ParsedLogRow } from '../google/index.js';
import { Banner } from './Banner.js';
import { MotivationalQuote } from './MotivationalQuote.js';
import { Activity, BicepsFlexed, Check, ChevronDown, Pencil, Plus, Star } from 'lucide-react';

interface WorkoutSelectProps {
	workouts: Workout[];
	missingLiftIds?: string[];
	schedule?: ScheduleEntry[];
	logRows?: ParsedLogRow[];
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
				{cardio ? (
					<span className="cardio-badge"><Activity size={24} /></span>
				) : (
					<span className="strength-badge"><BicepsFlexed size={24} /></span>
				)}
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

/** Get today's date in YYYY-MM-DD format using local time. */
function todayDateString(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function WorkoutSelect({ workouts, missingLiftIds, schedule, logRows, onSelect, onEdit, onNew, onToggleFavorite }: WorkoutSelectProps) {
	const { favorites, others } = useMemo(() => {
		const favorites: Workout[] = [];
		const others: Workout[] = [];
		for (const w of workouts) {
			if (w.favorite) favorites.push(w);
			else others.push(w);
		}
		return { favorites, others };
	}, [workouts]);

	const today = useMemo(() => todayDateString(), []);

	/** Workouts scheduled for today, with completion status. */
	const todaysPlan = useMemo(() => {
		if (!schedule) return [];
		const todayEntries = schedule.filter((e) => e.date === today);
		if (todayEntries.length === 0) return [];

		const workoutMap = new Map(workouts.map((w) => [w.id, w]));

		// Build a set of workoutIds that have log entries for today
		const completedIds = new Set<string>();
		if (logRows) {
			for (const row of logRows) {
				if (row.date === today) {
					completedIds.add(row.workoutId);
				}
			}
		}

		return todayEntries
			.map((e) => {
				const workout = workoutMap.get(e.workoutId);
				if (!workout) return null;
				return { workout, done: completedIds.has(e.workoutId) };
			})
			.filter((x): x is { workout: Workout; done: boolean } => x !== null);
	}, [schedule, logRows, workouts, today]);

	const [moreOpen, setMoreOpen] = useState(false);

	return (
		<div className="workout-select">
			<Banner />
			<MotivationalQuote />
			{todaysPlan.length > 0 && (
				<div className="todays-plan">
					<h3 className="todays-plan-heading">Today</h3>
					<div className="workout-list">
						{todaysPlan.map(({ workout: w, done }) => (
							<div key={w.id} className="today-card-row">
								<WorkoutCard w={w} onSelect={onSelect} cardio={w.category === 'cardio'} />
								{done && (
									<span className="today-done-badge" aria-label="Completed">
										<Check size={16} />
									</span>
								)}
							</div>
						))}
					</div>
				</div>
			)}
			{workouts.length === 0 ? (
				<p className="auth-error">
					No workouts available. Check that your sheet has valid lift
					configurations with numeric values for all weight fields.
				</p>
			) : (
				<div className="workout-list">
					{favorites.length > 0 && (
						<h3 className="section-heading">Favorites</h3>
					)}
					{favorites.map((w) => (
						<WorkoutCard key={w.id} w={w} onSelect={onSelect} onEdit={onEdit} onToggleFavorite={onToggleFavorite} cardio={w.category === 'cardio'} />
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
								<WorkoutCard key={w.id} w={w} onSelect={onSelect} onEdit={onEdit} onToggleFavorite={onToggleFavorite} cardio={w.category === 'cardio'} />
							))}
						</>
					)}
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
