import type { Workout } from '../model/index.js';
import { Banner } from './Banner.js';
import { LiftBadge } from './LiftBadge.js';

interface WorkoutSelectProps {
	workouts: Workout[];
	missingLiftIds?: string[];
	onSelect: (workout: Workout) => void;
}

export function WorkoutSelect({ workouts, missingLiftIds, onSelect }: WorkoutSelectProps) {
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
					{workouts.map((w) => (
						<button
							key={w.id}
							className="workout-card"
							onClick={() => onSelect(w)}
						>
							<LiftBadge liftId={w.exercises[0]?.liftId ?? 'unknown'} size={48} />
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
