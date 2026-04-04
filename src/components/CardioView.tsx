import { useState, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Workout } from '../model/index.js';
import type { CardioLogData } from '../google/index.js';

interface CardioViewProps {
	workout: Workout;
	onBack: () => void;
	onFinish: (workout: Workout, data: CardioLogData) => void;
}

export function CardioView({ workout, onBack, onFinish }: CardioViewProps) {
	const [duration, setDuration] = useState('');
	const [distance, setDistance] = useState('');
	const [elevation, setElevation] = useState('');
	const [weight, setWeight] = useState('');
	const [finished, setFinished] = useState(false);

	const handleFinish = useCallback(() => {
		const data: CardioLogData = {};
		if (duration) data.duration = Number(duration);
		if (distance) data.distance = Number(distance);
		if (elevation) data.elevation = Number(elevation);
		if (weight) data.weight = Number(weight);
		setFinished(true);
		onFinish(workout, data);
	}, [duration, distance, elevation, weight, workout, onFinish]);

	if (finished) {
		return (
			<div className="workout-view">
				<div className="workout-complete">
					<h2>{workout.name}</h2>
					<p>Logged!</p>
				</div>
			</div>
		);
	}

	return (
		<div className="workout-view">
			<div className="workout-header">
				<button className="btn-icon" onClick={onBack} aria-label="Back">
					<ArrowLeft size={20} />
				</button>
				<h2>{workout.name}</h2>
			</div>

			<div className="cardio-fields">
				<label className="cardio-field">
					<span className="cardio-label">Duration</span>
					<div className="cardio-input-group">
						<input
							type="number"
							inputMode="decimal"
							placeholder="—"
							value={duration}
							onFocus={(e) => e.target.select()}
							onChange={(e) => setDuration(e.target.value)}
						/>
						<span className="cardio-unit">min</span>
					</div>
				</label>

				<label className="cardio-field">
					<span className="cardio-label">Distance</span>
					<div className="cardio-input-group">
						<input
							type="number"
							inputMode="decimal"
							placeholder="—"
							value={distance}
							onFocus={(e) => e.target.select()}
							onChange={(e) => setDistance(e.target.value)}
						/>
						<span className="cardio-unit">mi</span>
					</div>
				</label>

				<label className="cardio-field">
					<span className="cardio-label">Elevation</span>
					<div className="cardio-input-group">
						<input
							type="number"
							inputMode="decimal"
							placeholder="—"
							value={elevation}
							onFocus={(e) => e.target.select()}
							onChange={(e) => setElevation(e.target.value)}
						/>
						<span className="cardio-unit">ft</span>
					</div>
				</label>

				<label className="cardio-field">
					<span className="cardio-label">Weight</span>
					<div className="cardio-input-group">
						<input
							type="number"
							inputMode="decimal"
							placeholder="—"
							value={weight}
							onFocus={(e) => e.target.select()}
							onChange={(e) => setWeight(e.target.value)}
						/>
						<span className="cardio-unit">lb</span>
					</div>
				</label>
			</div>

			<button className="btn-finish" onClick={handleFinish}>
				Finish
			</button>
		</div>
	);
}
