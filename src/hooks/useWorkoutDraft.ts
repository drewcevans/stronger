import type { SetResult } from '../model/index.js';

/**
 * localStorage key for in-progress workout data.
 * Stores workoutId, startTime, and set results so the user
 * can refresh without losing progress.
 */
const DRAFT_KEY = 'stronger_workout_draft';

/** Shape of the persisted draft. */
export interface WorkoutDraft {
	workoutId: string;
	startTime: string;
	results: SetResult[][];
}

/** Read the draft from localStorage (returns null if absent or corrupt). */
export function loadDraft(): WorkoutDraft | null {
	try {
		const raw = localStorage.getItem(DRAFT_KEY);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		if (!isDraft(parsed)) return null;
		return parsed;
	} catch {
		return null;
	}
}

/** Persist the current workout state to localStorage. */
export function saveDraft(draft: WorkoutDraft): void {
	try {
		localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
	} catch {
		// Quota exceeded or private browsing — silently ignore
	}
}

/** Remove the draft from localStorage. */
export function clearDraft(): void {
	try {
		localStorage.removeItem(DRAFT_KEY);
	} catch {
		// Ignore
	}
}

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

function isSetResult(v: unknown): v is SetResult {
	if (typeof v !== 'object' || v === null) return false;
	const o = v as Record<string, unknown>;
	return (
		typeof o.actualWeight === 'number' &&
		typeof o.actualReps === 'number' &&
		typeof o.completed === 'boolean' &&
		typeof o.actualSetType === 'string'
	);
}

function isDraft(v: unknown): v is WorkoutDraft {
	if (typeof v !== 'object' || v === null) return false;
	const o = v as Record<string, unknown>;
	if (typeof o.workoutId !== 'string' || typeof o.startTime !== 'string') return false;
	if (!Array.isArray(o.results)) return false;
	return (o.results as unknown[]).every(
		(ex) => Array.isArray(ex) && (ex as unknown[]).every(isSetResult),
	);
}
