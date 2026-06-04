import { useMemo, useState, useRef, useEffect } from 'react';
import type { Workout, ScheduleEntry, CardioActivity } from '../model/index.js';
import { FLAG_SENTINEL } from '../model/index.js';
import type { ParsedLogRow } from '../google/index.js';
import type { LogSession } from './CalendarView.js';
import { groupLogByDate } from './CalendarView.js';
import { Banner } from './Banner.js';
import { MotivationalQuote } from './MotivationalQuote.js';
import { BicepsFlexed, ChevronDown, Pencil, Plus, Star, Bike, Trash2, Check, X, Copy, MoreVertical, HeartPulse, Loader } from 'lucide-react';

interface WorkoutSelectProps {
	workouts: Workout[];
	missingLiftIds?: string[];
	schedule?: ScheduleEntry[];
	logRows?: ParsedLogRow[];
	onSelect: (workout: Workout) => void;
	onViewSession?: (session: LogSession) => void;
	onEdit?: (workoutId: string) => void;
	onDuplicate?: (workoutId: string) => void;
	onDelete?: (workoutId: string) => void;
	onNew?: () => void;
	onToggleFavorite?: (workoutId: string, favorite: boolean) => void;
	cardioActivities?: CardioActivity[];
	onCardioSave?: (activities: CardioActivity[]) => void;
	onCardioLogSave?: (date: string, workoutId: string, name: string, startTime: string, endTime: string) => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  CardioLogModal                                                      */
/* ------------------------------------------------------------------ */

function CardioLogModal({ name, onSave, onClose }: {
	name: string;
	onSave: (startTime: string, endTime: string) => Promise<void>;
	onClose: () => void;
}) {
	const [startTime, setStartTime] = useState<string | null>(null);
	const [endTime, setEndTime] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const fmtTime = (iso: string) =>
		new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

	return (
		<div className="cardio-modal-overlay" onClick={onClose}>
			<div className="cardio-modal" onClick={(e) => e.stopPropagation()}>
				<h3 className="cardio-modal-title">{name}</h3>
				<div className="cardio-modal-times">
					<button className="cardio-time-btn" onClick={() => setStartTime(new Date().toISOString())}>
						<span>Start Time</span>
						{startTime && <span className="cardio-time-val">{fmtTime(startTime)}</span>}
					</button>
					<button className="cardio-time-btn" onClick={() => setEndTime(new Date().toISOString())}>
						<span>End Time</span>
						{endTime && <span className="cardio-time-val">{fmtTime(endTime)}</span>}
					</button>
				</div>
				<div className="cardio-modal-actions">
					<button
						className="cardio-modal-btn-primary"
						disabled={!startTime || !endTime || saving}
						onClick={async () => {
							if (!startTime || !endTime) return;
							setSaving(true);
							try { await onSave(startTime, endTime); } finally { setSaving(false); }
						}}
					>
						{saving ? <Loader size={15} className="spin" /> : 'Complete'}
					</button>
					<button className="cardio-modal-btn-ghost" onClick={onClose}>Cancel</button>
				</div>
			</div>
		</div>
	);
}

type ScheduledItem =
	| { kind: 'workout'; workout: Workout; done: boolean }
	| { kind: 'cardio'; name: string; workoutId: string; done: boolean };

/* ------------------------------------------------------------------ */
/*  WorkoutCard                                                         */
/* ------------------------------------------------------------------ */

function WorkoutCard({
	w,
	onSelect,
	onEdit,
	onDuplicate,
	onDelete,
	onToggleFavorite,
	done,
}: {
	w: Workout;
	onSelect: (w: Workout) => void;
	onEdit?: (id: string) => void;
	onDuplicate?: (id: string) => void;
	onDelete?: (id: string) => void;
	onToggleFavorite?: (id: string, fav: boolean) => void;
	done?: boolean;
}) {
	const [menuOpen, setMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!menuOpen) return;
		const handleClick = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setMenuOpen(false);
			}
		};
		document.addEventListener('mousedown', handleClick);
		return () => document.removeEventListener('mousedown', handleClick);
	}, [menuOpen]);

	const hasMenu = onEdit || onDuplicate || onDelete;

	return (
		<div className={`workout-card-wrapper${done ? ' workout-card-wrapper-done' : ''}`}>
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
				className={`workout-card${done ? ' workout-card-done' : ''}`}
				onClick={() => onSelect(w)}
			>
				<span className="strength-badge"><BicepsFlexed size={24} /></span>
				<span className="workout-name">{w.name}</span>
			</button>
			{hasMenu && (
				<div className="workout-menu-container" ref={menuRef}>
					<button
						className="btn-edit-workout"
						aria-label={`Actions for ${w.name}`}
						onClick={() => setMenuOpen(!menuOpen)}
					>
						<MoreVertical size={16} />
					</button>
					{menuOpen && (
						<div className="workout-dropdown-menu">
							{onEdit && (
								<button className="workout-dropdown-item" onClick={() => { setMenuOpen(false); onEdit(w.id); }}>
									<Pencil size={14} /> Edit
								</button>
							)}
							{onDuplicate && (
								<button className="workout-dropdown-item" onClick={() => { setMenuOpen(false); onDuplicate(w.id); }}>
									<Copy size={14} /> Duplicate
								</button>
							)}
							{onDelete && (
								<button className="workout-dropdown-item workout-dropdown-item-danger" onClick={() => { setMenuOpen(false); onDelete(w.id); }}>
									<Trash2 size={14} /> Delete
								</button>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function todayDateString(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Normalize any date value from Google Sheets to YYYY-MM-DD.
 * Handles ISO strings, Date objects, and Sheets serial numbers.
 */
function normalizeDate(d: unknown): string {
	if (!d) return '';
	if (d instanceof Date) return d.toISOString().split('T')[0];
	const str = String(d);
	// Google Sheets date serial (e.g. "46000")
	if (/^\d+$/.test(str)) {
		const date = new Date((Number(str) - 25569) * 86400 * 1000);
		return date.toISOString().split('T')[0];
	}
	// ISO string with time component
	if (str.includes('T')) return str.split('T')[0];
	return str.trim().slice(0, 10);
}

function getWeekDates(anchor: Date = new Date()): string[] {
	const day = anchor.getDay(); // 0=Sun
	const offset = day === 0 ? -6 : 1 - day;
	const mon = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + offset);
	return Array.from({ length: 7 }, (_, i) => {
		const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	});
}

function formatDayLabel(dateStr: string): string {
	const [y, m, d] = dateStr.split('-').map(Number);
	const dt = new Date(y, m - 1, d);
	const dow = dt.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
	const rest = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	return `${dow}, ${rest}`;
}

/* ------------------------------------------------------------------ */
/*  WorkoutSelect                                                       */
/* ------------------------------------------------------------------ */

export function WorkoutSelect({
	workouts,
	missingLiftIds,
	schedule,
	logRows,
	onSelect,
	onViewSession,
	onEdit,
	onDuplicate,
	onDelete,
	onNew,
	onToggleFavorite,
	cardioActivities,
	onCardioSave,
	onCardioLogSave,
}: WorkoutSelectProps) {
	const today = useMemo(() => todayDateString(), []);
	const weekDates = useMemo(() => getWeekDates(), []);
	const todayCardRef = useRef<HTMLDivElement>(null);
	const [cardioModal, setCardioModal] = useState<{ date: string; workoutId: string; name: string } | null>(null);

	// Log schedule entries on each render for debugging date format issues
	useEffect(() => {
		if (schedule && schedule.length > 0) {
			console.log('[WeekView] schedule entries (from app state):', schedule.map((e) => ({ date: e.date, workoutId: e.workoutId })));
		}
	}, [schedule]);

	// Scroll today's card into view on mount
	useEffect(() => {
		if (todayCardRef.current) {
			todayCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
	}, []);

	// Debug: log raw schedule dates so format mismatches are visible
	useEffect(() => {
		if (schedule && schedule.length > 0) {
			console.log('[WorkoutSelect] raw schedule dates:', schedule.map((e) => e.date));
		}
	}, [schedule]);

	// Per-day data for the week stack
	const weekData = useMemo(() => {
		const workoutMap = new Map(workouts.map((w) => [w.id, w]));
		const workoutNames = new Map(workouts.map((w) => [w.id, w.name]));
		const cardioMap = new Map((cardioActivities ?? []).map((a) => [a.id, a.name]));

		// Normalize all log rows by date
		const completedByDate = new Map<string, Set<string>>();
		const logDateSet = new Set<string>();
		if (logRows) {
			for (const row of logRows) {
				const d = normalizeDate(row.date);
				logDateSet.add(d);
				const s = completedByDate.get(d) ?? new Set<string>();
				s.add(row.workoutId);
				completedByDate.set(d, s);
			}
		}

		// All sessions grouped by date (for onViewSession)
		const allSessionsByDate = logRows
			? groupLogByDate(logRows, workoutNames)
			: new Map<string, LogSession[]>();

		return weekDates.map((date) => {
			// Use schedule prop; normalizeDate handles any date format from the sheet
			const dayEntries = (schedule ?? []).filter(
				(e) => normalizeDate(e.date) === date && e.workoutId && e.workoutId !== FLAG_SENTINEL,
			);

			const scheduledItems: ScheduledItem[] = dayEntries
				.map((e) => {
					const done = completedByDate.get(date)?.has(e.workoutId) ?? false;
					if (e.workoutId.startsWith('cardio:')) {
						const cardioId = e.workoutId.slice('cardio:'.length);
						const name = cardioMap.get(cardioId) ?? cardioId;
						return { kind: 'cardio' as const, name, workoutId: e.workoutId, done };
					}
					const workout = workoutMap.get(e.workoutId);
					if (!workout) return null;
					return { kind: 'workout' as const, workout, done };
				})
				.filter((x): x is ScheduledItem => x !== null);

			const hasLog = logDateSet.has(date);

			// Session map for this date
			const sessions = new Map<string, LogSession>();
			for (const s of allSessionsByDate.get(date) ?? []) {
				sessions.set(s.key.workoutId, s);
			}

			// Deduplicated completed workout names for the done-chip
			const completedWorkoutNames = [...new Set(
				[...sessions.values()].map((s) => {
					// Strip 'cardio:' prefix for display
					const n = s.workoutName;
					return n.startsWith('cardio:') ? n.slice('cardio:'.length) : n;
				}).filter(Boolean),
			)];

			return { date, scheduledItems, hasLog, sessions, completedWorkoutNames };
		});
	}, [weekDates, workouts, cardioActivities, schedule, logRows]);

	// Workout library list
	const { favorites, others } = useMemo(() => {
		const favorites: Workout[] = [];
		const others: Workout[] = [];
		for (const w of workouts) {
			if (w.favorite) favorites.push(w);
			else others.push(w);
		}
		return { favorites, others };
	}, [workouts]);

	const [moreOpen, setMoreOpen] = useState(false);

	return (
		<div className="workout-select">
			<Banner />
			<MotivationalQuote />

			{/* Week day cards */}
			<div className="week-stack">
				{weekData.map(({ date, scheduledItems, hasLog, sessions, completedWorkoutNames }) => {
					const isToday = date === today;
					const isPast = date < today;

						const isDone = completedWorkoutNames.length > 0;
					return (
						<div
							key={date}
							ref={isToday ? todayCardRef : undefined}
							className={[
								'week-stack-card',
								isToday ? 'week-stack-card--today' : '',
								isPast ? 'week-stack-card--past' : '',
							].filter(Boolean).join(' ')}
						>
							<div className="week-stack-header">
								<span className="week-stack-date">{formatDayLabel(date)}</span>
								{!isPast && isDone && <span className="week-stack-check">✓</span>}
							</div>

							{isPast ? (
								scheduledItems.length > 0 ? (
									<div className="week-stack-past-items">
										{scheduledItems.map((item) => {
											const name = item.kind === 'cardio' ? item.name : item.workout.name;
											const key = item.kind === 'cardio' ? item.workoutId : item.workout.id;
											return (
												<div key={key} className={`week-stack-past-row${item.done ? ' week-stack-past-row--done' : ''}`}>
													<span className="week-stack-past-name">{name}</span>
													<span className="week-stack-past-check">✓</span>
												</div>
											);
										})}
									</div>
								) : completedWorkoutNames.length > 0 ? (
									<p className="week-stack-completed-names">
										{completedWorkoutNames.slice(0, 2).join(', ')}
									</p>
								) : (
									<p className="week-stack-rest">Rest day</p>
								)
							) : scheduledItems.length > 0 ? (
								<div className="week-stack-workouts">
									{scheduledItems.map((item) =>
										item.kind === 'cardio' ? (
											<div key={item.workoutId} className="workout-card-wrapper">
												<button
													className="workout-card week-cardio-card"
													onClick={() => setCardioModal({ date, workoutId: item.workoutId, name: item.name })}
												>
													<span className="strength-badge week-cardio-badge">
														<HeartPulse size={24} />
													</span>
													<span className="workout-name">{item.name}</span>
												</button>
											</div>
										) : (
											<WorkoutCard
												key={item.workout.id}
												w={item.workout}
												done={item.done}
												onSelect={() => {
													if (item.done && onViewSession) {
														const session = sessions.get(item.workout.id);
														if (session) { onViewSession(session); return; }
													}
													onSelect(item.workout);
												}}
											/>
										)
									)}
								</div>
							) : (
								<p className="week-stack-rest">Rest day</p>
							)}
						</div>
					);
				})}
			</div>

			{/* Full workout library */}
			{workouts.length === 0 ? (
				<p className="auth-error">
					No workouts available. Check that your sheet has valid lift
					configurations with numeric values for all weight fields.
				</p>
			) : (
				<div className="workout-list">
					{favorites.map((w) => (
						<WorkoutCard key={w.id} w={w} onSelect={onSelect} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} onToggleFavorite={onToggleFavorite} />
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
								<WorkoutCard key={w.id} w={w} onSelect={onSelect} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} onToggleFavorite={onToggleFavorite} />
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

			{cardioActivities && onCardioSave && (
				<CardioSection activities={cardioActivities} onSave={onCardioSave} />
			)}

			{missingLiftIds && missingLiftIds.length > 0 && (
				<p className="config-warning">
					Missing lift configs: {missingLiftIds.join(', ')}
				</p>
			)}

			{cardioModal && (
				<CardioLogModal
					name={cardioModal.name}
					onSave={async (start, end) => {
						await onCardioLogSave?.(cardioModal.date, cardioModal.workoutId, cardioModal.name, start, end);
						setCardioModal(null);
					}}
					onClose={() => setCardioModal(null)}
				/>
			)}
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  Cardio section                                                     */
/* ------------------------------------------------------------------ */

function nameToCardioId(name: string): string {
	return name.trim().toLowerCase().replace(/\s+/g, '-');
}

function CardioSection({ activities, onSave }: { activities: CardioActivity[]; onSave: (a: CardioActivity[]) => void }) {
	const [open, setOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editName, setEditName] = useState('');
	const [adding, setAdding] = useState(false);
	const [newName, setNewName] = useState('');

	const handleEdit = (a: { id: string; name: string }) => {
		setEditingId(a.id);
		setEditName(a.name);
		setAdding(false);
	};

	const handleEditSave = () => {
		const trimmed = editName.trim();
		if (!trimmed || !editingId) return;
		const newId = nameToCardioId(trimmed);
		const updated = activities
			.map((a) => a.id === editingId ? { id: newId, name: trimmed } : a)
			.sort((a, b) => a.name.localeCompare(b.name));
		onSave(updated);
		setEditingId(null);
		setEditName('');
	};

	const handleEditCancel = () => { setEditingId(null); setEditName(''); };

	const handleDelete = (id: string) => { onSave(activities.filter((a) => a.id !== id)); };

	const handleAddStart = () => { setAdding(true); setNewName(''); setEditingId(null); };

	const handleAddSave = () => {
		const trimmed = newName.trim();
		if (!trimmed) return;
		const id = nameToCardioId(trimmed);
		if (activities.some((a) => a.id === id)) return;
		onSave([...activities, { id, name: trimmed }].sort((a, b) => a.name.localeCompare(b.name)));
		setAdding(false);
		setNewName('');
	};

	const handleAddCancel = () => { setAdding(false); setNewName(''); };

	return (
		<div className="cardio-section">
			<button className="btn-cardio-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
				<Bike size={18} />
				Cardio
				<ChevronDown size={16} className={`more-chevron${open ? ' more-chevron-open' : ''}`} />
			</button>
			{open && (
				<div className="cardio-list">
					{activities.map((a) => (
						<div key={a.id} className="cardio-item">
							{editingId === a.id ? (
								<div className="cardio-edit-row">
									<input
										className="cardio-edit-input"
										value={editName}
										onChange={(e) => setEditName(e.target.value)}
										onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(); if (e.key === 'Escape') handleEditCancel(); }}
										autoFocus
									/>
									<button className="btn-cardio-action btn-cardio-confirm" onClick={handleEditSave} aria-label="Save"><Check size={14} /></button>
									<button className="btn-cardio-action btn-cardio-cancel" onClick={handleEditCancel} aria-label="Cancel"><X size={14} /></button>
								</div>
							) : (
								<>
									<span className="cardio-name">{a.name}</span>
									<button className="btn-cardio-action" onClick={() => handleEdit(a)} aria-label={`Edit ${a.name}`}><Pencil size={14} /></button>
									<button className="btn-cardio-action btn-cardio-delete" onClick={() => handleDelete(a.id)} aria-label={`Delete ${a.name}`}><Trash2 size={14} /></button>
								</>
							)}
						</div>
					))}
					{adding ? (
						<div className="cardio-edit-row cardio-add-row">
							<input
								className="cardio-edit-input"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								onKeyDown={(e) => { if (e.key === 'Enter') handleAddSave(); if (e.key === 'Escape') handleAddCancel(); }}
								placeholder="Activity name"
								autoFocus
							/>
							<button className="btn-cardio-action btn-cardio-confirm" onClick={handleAddSave} aria-label="Save"><Check size={14} /></button>
							<button className="btn-cardio-action btn-cardio-cancel" onClick={handleAddCancel} aria-label="Cancel"><X size={14} /></button>
						</div>
					) : (
						<button className="btn-new-cardio" onClick={handleAddStart}>
							<Plus size={16} /> New Activity
						</button>
					)}
				</div>
			)}
		</div>
	);
}
