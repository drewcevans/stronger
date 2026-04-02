import type { Workout } from '../model/index.js';

interface WorkoutSelectProps {
	workouts: Workout[];
	onSelect: (workout: Workout) => void;
}

export function WorkoutSelect({ workouts, onSelect }: WorkoutSelectProps) {
	return (
		<div className="workout-select">
			<h1 className="app-title">Stronger</h1>
			<p className="subtitle">Choose a workout</p>
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
							<span className="workout-id">{w.id}</span>
							<span className="workout-name">{w.name}</span>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
