import { useState, useMemo, useCallback } from 'react';
import type { Workout, ScheduleEntry } from '../model/index.js';
import { CalendarPlus, X, ChevronRight, Activity, Dumbbell } from 'lucide-react';

interface CalendarViewProps {
	workouts: Workout[];
	schedule: ScheduleEntry[];
	onAssign: (date: string, workoutId: string) => void;
	onRemove: (date: string, workoutId: string) => void;
	onOpenWorkout: (workoutId: string) => void;
	onBack: () => void;
}

/** Format a YYYY-MM-DD string for display. */
function formatDate(dateStr: string): { weekday: string; display: string } {
	const [y, m, d] = dateStr.split('-').map(Number);
	const date = new Date(y, m - 1, d);
	const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
	const display = date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
	});
	return { weekday, display };
}

/** Check if a date string falls on a weekend (Saturday or Sunday). */
function isWeekend(dateStr: string): boolean {
	const [y, m, d] = dateStr.split('-').map(Number);
	const day = new Date(y, m - 1, d).getDay();
	return day === 0 || day === 6;
}

/** Check if a date string is today. */
function isToday(dateStr: string): boolean {
	const now = new Date();
	const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
	return dateStr === today;
}

/** Generate an array of YYYY-MM-DD strings starting from today for `count` days. */
function generateDays(count: number): string[] {
	const days: string[] = [];
	const now = new Date();
	for (let i = 0; i < count; i++) {
		const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
		days.push(
			`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
		);
	}
	return days;
}

export function CalendarView({
	workouts,
	schedule,
	onAssign,
	onRemove,
	onOpenWorkout,
	onBack,
}: CalendarViewProps) {
	const [addingForDate, setAddingForDate] = useState<string | null>(null);

	const days = useMemo(() => generateDays(28), []);

	// Build a map of date → workoutIds for fast lookup
	const scheduleMap = useMemo(() => {
		const map = new Map<string, string[]>();
		for (const entry of schedule) {
			const existing = map.get(entry.date) ?? [];
			existing.push(entry.workoutId);
			map.set(entry.date, existing);
		}
		return map;
	}, [schedule]);

	// Build a map of workoutId → workout name for display
	const workoutNames = useMemo(() => {
		const map = new Map<string, string>();
		for (const w of workouts) {
			map.set(w.id, w.name);
		}
		return map;
	}, [workouts]);

	// Build a set of cardio workout IDs for quick lookup
	const cardioIds = useMemo(() => {
		const ids = new Set<string>();
		for (const w of workouts) {
			if (w.category === 'cardio') ids.add(w.id);
		}
		return ids;
	}, [workouts]);

	// Split workouts into strength and cardio for the picker
	const { strengthWorkouts, cardioWorkouts } = useMemo(() => {
		const strengthWorkouts: Workout[] = [];
		const cardioWorkouts: Workout[] = [];
		for (const w of workouts) {
			if (w.category === 'cardio') cardioWorkouts.push(w);
			else strengthWorkouts.push(w);
		}
		return { strengthWorkouts, cardioWorkouts };
	}, [workouts]);

	const handleAssign = useCallback(
		(workoutId: string) => {
			if (addingForDate) {
				onAssign(addingForDate, workoutId);
				setAddingForDate(null);
			}
		},
		[addingForDate, onAssign],
	);

	return (
		<div className="calendar-view">
			<div className="calendar-header">
				<button className="btn-back" onClick={onBack}>
					← Back
				</button>
				<h2 className="calendar-title">Schedule</h2>
			</div>

			<div className="calendar-days">
				{days.map((dateStr) => {
					const { weekday, display } = formatDate(dateStr);
					const today = isToday(dateStr);
					const assigned = scheduleMap.get(dateStr) ?? [];

					return (
						<div
							key={dateStr}
							className={`calendar-day${today ? ' calendar-day-today' : ''}${isWeekend(dateStr) ? ' calendar-day-weekend' : ''}`}
						>
							<div className="calendar-day-header">
								<div className="calendar-day-date">
									<span className="calendar-weekday">{weekday}</span>
									<span className="calendar-display-date">{display}</span>
									{today && <span className="calendar-today-badge">Today</span>}
								</div>
								<button
									className="calendar-add-btn"
									onClick={() => setAddingForDate(dateStr)}
									aria-label={`Add workout to ${display}`}
								>
									<CalendarPlus size={18} />
								</button>
							</div>

							{assigned.length > 0 && (
								<div className="calendar-workouts">
									{assigned.map((wid, idx) => {
										const isCardio = cardioIds.has(wid);
										return (
											<div key={`${wid}-${idx}`} className={`calendar-workout-item${isCardio ? ' calendar-workout-cardio' : ''}`}>
												{isCardio ? (
													<span className="calendar-workout-link calendar-workout-link-cardio">
														<Activity size={14} />
														<span className="calendar-workout-name">
															{workoutNames.get(wid) ?? wid}
														</span>
													</span>
												) : (
													<button
														className="calendar-workout-link calendar-workout-link-strength"
														onClick={() => onOpenWorkout(wid)}
													>
														<Dumbbell size={14} />
														<span className="calendar-workout-name">
															{workoutNames.get(wid) ?? wid}
														</span>
														<ChevronRight size={14} />
													</button>
												)}
												<button
													className="calendar-remove-btn"
													onClick={() => onRemove(dateStr, wid)}
													aria-label={`Remove ${workoutNames.get(wid) ?? wid}`}
												>
													<X size={14} />
												</button>
											</div>
										);
									})}
								</div>
							)}

							{/* Workout picker overlay for this day */}
							{addingForDate === dateStr && (
								<div className="calendar-picker">
									<div className="calendar-picker-header">
										<span>Assign workout</span>
										<button
											className="calendar-picker-close"
											onClick={() => setAddingForDate(null)}
										>
											<X size={16} />
										</button>
									</div>
									<div className="calendar-picker-list">
										{strengthWorkouts.map((w) => (
											<button
												key={w.id}
												className="calendar-picker-item calendar-picker-item-strength"
												onClick={() => handleAssign(w.id)}
											>
												<Dumbbell size={14} />
												{w.name}
											</button>
										))}
										{cardioWorkouts.length > 0 && strengthWorkouts.length > 0 && (
											<div className="calendar-picker-divider">Cardio</div>
										)}
										{cardioWorkouts.map((w) => (
											<button
												key={w.id}
												className="calendar-picker-item calendar-picker-item-cardio"
												onClick={() => handleAssign(w.id)}
											>
												<Activity size={14} />
												{w.name}
											</button>
										))}
									</div>
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
