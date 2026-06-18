import { useMemo, useState, useRef, useEffect } from 'react';
import type { Workout, ScheduleEntry, CardioActivity } from '../model/index.js';
import { FLAG_SENTINEL } from '../model/index.js';
import type { ParsedLogRow } from '../google/index.js';
import type { LogSession } from './CalendarView.js';
import { groupLogByDate } from './CalendarView.js';
import { Banner } from './Banner.js';
import quotes from '../../lib/quotes.json';
import {
	BicepsFlexed, ChevronDown, Pencil, Plus, Star, Bike, Trash2, Check, X, Copy, MoreVertical, Loader,
} from 'lucide-react';
import { WorkoutChaosArt } from './WorkoutChaosArt.js';
import chaosXDone from '../assets/chaos-x-done.png';
import chaosRest from '../assets/chaos-rest.png';
import { SketchyBorder } from './SketchyBorder.js';

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
	const [startTime, setStartTime] = useState('');
	const [endTime, setEndTime] = useState('');
	const [saving, setSaving] = useState(false);

	const nowHHMM = () => {
		const now = new Date();
		return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
	};

	const toISO = (hhmm: string) => {
		const [h, m] = hhmm.split(':').map(Number);
		const d = new Date();
		d.setHours(h, m, 0, 0);
		return d.toISOString();
	};

	return (
		<div className="cardio-modal-overlay" onClick={onClose}>
			<div className="cardio-modal" onClick={(e) => e.stopPropagation()}>
				<h3 className="cardio-modal-title">{name}</h3>
				<div className="cardio-modal-times">
					<div className="cardio-time-row">
						<button className="cardio-time-btn" onClick={() => setStartTime(nowHHMM())}>
							Set Start Time
						</button>
						<input
							className="cardio-time-input"
							type="time"
							value={startTime}
							onChange={(e) => setStartTime(e.target.value)}
						/>
					</div>
					<div className="cardio-time-row">
						<button className="cardio-time-btn" onClick={() => setEndTime(nowHHMM())}>
							Set End Time
						</button>
						<input
							className="cardio-time-input"
							type="time"
							value={endTime}
							onChange={(e) => setEndTime(e.target.value)}
						/>
					</div>
				</div>
				<div className="cardio-modal-actions">
					<button
						className="cardio-modal-btn-primary"
						disabled={!startTime || !endTime || saving}
						onClick={async () => {
							if (!startTime || !endTime) return;
							setSaving(true);
							try { await onSave(toISO(startTime), toISO(endTime)); } finally { setSaving(false); }
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

function normalizeDate(d: unknown): string {
	if (!d) return '';
	if (d instanceof Date) return d.toISOString().split('T')[0];
	const str = String(d);
	if (/^\d+$/.test(str)) {
		const date = new Date((Number(str) - 25569) * 86400 * 1000);
		return date.toISOString().split('T')[0];
	}
	if (str.includes('T')) return str.split('T')[0];
	return str.trim().slice(0, 10);
}

function formatDayLabel(dateStr: string): string {
	const [y, m, d] = dateStr.split('-').map(Number);
	const dt = new Date(y, m - 1, d);
	const dow = dt.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
	const rest = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	return `${dow}, ${rest}`;
}

function getEndOfWeekDate(todayStr: string): string {
	const [y, m, d] = todayStr.split('-').map(Number);
	const dt = new Date(y, m - 1, d);
	const dow = dt.getDay(); // 0=Sun … 6=Sat
	const daysUntilSunday = dow === 0 ? 0 : 7 - dow;
	const sun = new Date(y, m - 1, d + daysUntilSunday);
	return `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, '0')}-${String(sun.getDate()).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/*  TodayHeroCard — one card per workout item                          */
/* ------------------------------------------------------------------ */

function TodayHeroCard({ date, item, sessions, onSelect, onViewSession, onCardioLog }: {
	date: string;
	item: ScheduledItem | null;
	sessions: Map<string, LogSession>;
	onSelect: (w: Workout) => void;
	onViewSession?: (s: LogSession) => void;
	onCardioLog: (date: string, workoutId: string, name: string) => void;
}) {
	const cardQuote = useMemo(
		() => (quotes as string[])[Math.floor(Math.random() * quotes.length)],
		[],
	);

	const workoutId = item == null ? '' : item.kind === 'workout' ? item.workout.id : item.workoutId;
	const name = item == null ? null : item.kind === 'workout' ? item.workout.name : item.name;
	const isCompleted = item?.done ?? false;

	const handleActivate = () => {
		if (item == null) return;
		if (item.kind === 'workout') {
			if (item.done && onViewSession) {
				const session = sessions.get(item.workout.id);
				if (session) { onViewSession(session); return; }
			}
			onSelect(item.workout);
		} else {
			onCardioLog(date, item.workoutId, item.name);
		}
	};

	return (
		<div
			className="punk-hero"
			role="button"
			tabIndex={0}
			onClick={handleActivate}
			onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
		>
			<div className="punk-halftone" />
			<div className="punk-scanline" />
			<div className="punk-stamp">PUNK</div>

			{item == null ? (
				<img
					src={chaosRest}
					style={{
						position: 'absolute',
						right: '-25px',
						top: '-10px',
						bottom: '-10px',
						width: '270px',
						objectFit: 'contain',
						objectPosition: 'right center',
						opacity: 0.88,
						pointerEvents: 'none',
						zIndex: 3,
					}}
					alt=""
				/>
			) : (
				<WorkoutChaosArt workoutId={workoutId} dimmed={isCompleted} />
			)}

			{isCompleted && (
				<img
					src={chaosXDone}
					style={{
						position: 'absolute',
						inset: 0,
						width: '100%',
						height: '100%',
						objectFit: 'cover',
						objectPosition: 'center',
						opacity: 1,
						borderRadius: 16,
						pointerEvents: 'none',
						zIndex: 6,
						mixBlendMode: 'normal',
					}}
					alt=""
				/>
			)}

			<div className="punk-content">
				{name == null ? (
					<div className="punk-graffiti-wrap">
						<span className="punk-graffiti-cyan">REST</span>
						<span className="punk-graffiti-pink">REST</span>
						<span className="punk-graffiti-main">REST</span>
					</div>
				) : (
					<div className="punk-graffiti-wrap">
						<span className="punk-graffiti-cyan">{name}</span>
						<span className="punk-graffiti-pink">{name}</span>
						<span
							className="punk-graffiti-main"
							style={isCompleted ? { textShadow: '0 0 20px rgba(255,20,147,0.5)' } : undefined}
						>
							{name}
						</span>
					</div>
				)}

				<div className="punk-bottom">
					<p className="punk-quote">"{cardQuote}"</p>
				</div>
			</div>
		</div>
	);
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
	const [cardioModal, setCardioModal] = useState<{ date: string; workoutId: string; name: string } | null>(null);

	const { todayItems, todaySessions, upcomingDays, recentDays } = useMemo(() => {
		const workoutMap = new Map(workouts.map((w) => [w.id, w]));
		const workoutNames = new Map(workouts.map((w) => [w.id, w.name]));
		const cardioMap = new Map((cardioActivities ?? []).map((a) => [a.id, a.name]));

		const completedByDate = new Map<string, Set<string>>();
		if (logRows) {
			for (const row of logRows) {
				const d = normalizeDate(row.date);
				const s = completedByDate.get(d) ?? new Set<string>();
				s.add(row.workoutId);
				completedByDate.set(d, s);
			}
		}

		const allSessionsByDate = logRows
			? groupLogByDate(logRows, workoutNames)
			: new Map<string, LogSession[]>();

		const buildItems = (date: string): ScheduledItem[] =>
			(schedule ?? [])
				.filter((e) => normalizeDate(e.date) === date && e.workoutId && e.workoutId !== FLAG_SENTINEL)
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

		// Today
		const todayItems = buildItems(today);
		const todaySessions = new Map<string, LogSession>();
		for (const s of allSessionsByDate.get(today) ?? []) {
			todaySessions.set(s.key.workoutId, s);
		}

		// Upcoming: all future days in current week (tomorrow through Sunday)
		const endOfWeek = getEndOfWeekDate(today);
		const [ty, tm, td] = today.split('-').map(Number);
		const upcomingDays: Array<{ date: string; items: ScheduledItem[] }> = [];
		{
			const [ey, em, ed] = endOfWeek.split('-').map(Number);
			const endDt = new Date(ey, em - 1, ed);
			let cur = new Date(ty, tm - 1, td + 1);
			while (cur <= endDt) {
				const d = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
				upcomingDays.push({ date: d, items: buildItems(d) });
				cur.setDate(cur.getDate() + 1);
			}
		}

		// Recent: all past days of current week (Mon through yesterday), most recent first
		const dow = new Date(ty, tm - 1, td).getDay(); // 0=Sun,1=Mon,...,6=Sat
		const daysToMonday = dow === 0 ? 6 : dow - 1;
		const recentDays = Array.from({ length: daysToMonday }, (_, i) => {
			const dt = new Date(ty, tm - 1, td - i - 1);
			const date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
			return { date, items: buildItems(date) };
		});

		return { todayItems, todaySessions, upcomingDays, recentDays };
	}, [schedule, workouts, cardioActivities, logRows, today]);

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
	const hasRecentItems = recentDays.length > 0;

	return (
		<div className="workout-select">
			<Banner />

			{/* TODAY section — label + date match COMING UP / RECENT style */}
			<div className="home-section">
				<p className="home-section-label">TODAY &nbsp;·&nbsp; {formatDayLabel(today)}</p>

				{/* One hero card per workout (or single rest-day card) */}
				<div className="today-cards-stack">
					{todayItems.length === 0 ? (
						<TodayHeroCard
							date={today}
							item={null}
							sessions={todaySessions}
							onSelect={onSelect}
							onViewSession={onViewSession}
							onCardioLog={(date, workoutId, name) => setCardioModal({ date, workoutId, name })}
						/>
					) : (
						todayItems.map((item) => {
							const key = item.kind === 'cardio' ? item.workoutId : item.workout.id;
							return (
								<TodayHeroCard
									key={key}
									date={today}
									item={item}
									sessions={todaySessions}
									onSelect={onSelect}
									onViewSession={onViewSession}
									onCardioLog={(date, workoutId, name) => setCardioModal({ date, workoutId, name })}
								/>
							);
						})
					)}
				</div>
			</div>

			<div className="home-section">
				<p className="home-section-label">COMING UP</p>
				{upcomingDays.length === 0 ? (
					<p className="no-upcoming-text">No more workouts this week</p>
				) : (
					<div className="upcoming-list">
						{upcomingDays.map(({ date, items }) => (
							<div key={date} className="punk-coming-up-card">
								<SketchyBorder cardHeight={Math.max(items.length, 1) * 32 + 45} />
								<div style={{ position: 'relative', zIndex: 1 }}>
									<span className="punk-coming-up-day">{formatDayLabel(date)}</span>
									{items.length === 0 ? (
										<span className="punk-coming-up-name">REST DAY</span>
									) : (
										items.map((item) => {
											const key = item.kind === 'cardio' ? item.workoutId : item.workout.id;
											const name = item.kind === 'cardio' ? item.name : item.workout.name;
											return (
												<button
													key={key}
													className="punk-coming-up-name"
													onClick={() => {
														if (item.kind === 'cardio') {
															setCardioModal({ date, workoutId: item.workoutId, name: item.name });
														} else {
															onSelect(item.workout);
														}
													}}
												>
													{name}
												</button>
											);
										})
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{hasRecentItems && (
				<div className="home-section">
					<p className="home-section-label">RECENT</p>
					<div className="recent-list">
						{recentDays.map(({ date, items }) => (
							<div key={date} className="recent-card punk-recent-card">
								<span className="recent-card-date">{formatDayLabel(date)}</span>
								{items.length === 0 ? (
									<div className="recent-workout-row">
										<span className="recent-workout-name">Rest Day</span>
									</div>
								) : (
									items.map((item) => {
										const key = item.kind === 'cardio' ? item.workoutId : item.workout.id;
										const name = item.kind === 'cardio' ? item.name : item.workout.name;
										return (
											<div key={key} className="recent-workout-row">
												<span className={item.done ? 'recent-workout-done' : 'recent-workout-name'}>{name}</span>
												{item.done && <span className="recent-check">✓</span>}
											</div>
										);
									})
								)}
							</div>
						))}
					</div>
				</div>
			)}

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

			<div style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '10px', color: 'rgba(255,255,255,0.2)', padding: '8px', marginTop: '16px' }}>
				v0.0.2
			</div>
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
