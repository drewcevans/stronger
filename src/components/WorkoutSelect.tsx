import { useMemo } from 'react';
import type { Workout } from '../model/index.js';
import { Banner } from './Banner.js';
import { LiftBadge } from './LiftBadge.js';
import { Activity } from 'lucide-react';

interface WorkoutSelectProps {
	workouts: Workout[];
	missingLiftIds?: string[];
	onSelect: (workout: Workout) => void;
}

export function WorkoutSelect({ workouts, missingLiftIds, onSelect }: WorkoutSelectProps) {
	const { strength, cardio } = useMemo(() => {
		const strength: Workout[] = [];
		const cardio: Workout[] = [];
		for (const w of workouts) {
			if (w.category === 'cardio') cardio.push(w);
			else strength.push(w);
		}
		return { strength, cardio };
	}, [workouts]);

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
					{strength.map((w) => (
						<button
							key={w.id}
							className="workout-card"
							onClick={() => onSelect(w)}
						>
							<LiftBadge liftId={w.exercises[0]?.liftId ?? 'unknown'} size={48} />
							<span className="workout-name">{w.name}</span>
						</button>
					))}
					{cardio.length > 0 && strength.length > 0 && (
						<div className="category-divider">
							<span className="category-divider-label">Cardio</span>
						</div>
					)}
					{cardio.map((w) => (
						<button
							key={w.id}
							className="workout-card workout-card-cardio"
							onClick={() => onSelect(w)}
						>
							<span className="cardio-badge">
								<Activity size={24} />
							</span>
							<span className="workout-name">{w.name}</span>
						</button>
					))}
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
