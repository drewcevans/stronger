import { useState, useEffect, useCallback, useRef } from 'react';

export interface RestTimerState {
	/** Index of the exercise whose header should display the timer, or null if inactive. */
	exerciseIdx: number | null;
	/** Elapsed seconds since the timer started. */
	elapsed: number;
}

/** Shape of the localStorage sentinel. */
interface TimerSentinel {
	exerciseIdx: number;
	startedAt: number; // Date.now() when the timer was started
}

const SENTINEL_KEY = 'stronger_rest_timer';

/** Read the sentinel from localStorage (returns null if absent or corrupt). */
export function loadSentinel(): TimerSentinel | null {
	try {
		const raw = localStorage.getItem(SENTINEL_KEY);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		if (
			typeof parsed === 'object' &&
			parsed !== null &&
			typeof (parsed as Record<string, unknown>).exerciseIdx === 'number' &&
			typeof (parsed as Record<string, unknown>).startedAt === 'number'
		) {
			return parsed as TimerSentinel;
		}
		return null;
	} catch {
		return null;
	}
}

/** Write the sentinel to localStorage. */
function saveSentinel(sentinel: TimerSentinel): void {
	try {
		localStorage.setItem(SENTINEL_KEY, JSON.stringify(sentinel));
	} catch {
		// Quota exceeded or private browsing — silently ignore
	}
}

/** Remove the sentinel from localStorage. */
export function clearSentinel(): void {
	try {
		localStorage.removeItem(SENTINEL_KEY);
	} catch {
		// Ignore
	}
}

/**
 * Format elapsed seconds as M:SS (e.g., 0:00, 1:45, 12:03).
 */
export function formatElapsed(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Determine which exercise header should display the timer.
 *
 * - If the completed set is NOT the last set of its exercise, the timer
 *   appears on the same exercise's header.
 * - If it IS the last set, the timer appears on the next exercise's header.
 * - If it's the last set of the last exercise, it stays on the current header.
 */
export function resolveTimerExercise(
	exerciseIdx: number,
	setIdx: number,
	totalSetsPerExercise: number[],
): number {
	const isLastSet = setIdx >= totalSetsPerExercise[exerciseIdx] - 1;
	const isLastExercise = exerciseIdx >= totalSetsPerExercise.length - 1;
	if (isLastSet && !isLastExercise) {
		return exerciseIdx + 1;
	}
	return exerciseIdx;
}

/**
 * Count-up rest timer that auto-starts when a set is completed.
 * Only one timer is active at a time — starting a new one replaces the previous.
 *
 * Persists a timestamp sentinel to localStorage so the timer survives
 * page navigations and browser backgrounding. The sentinel is cleared
 * when the timer is explicitly stopped (e.g. finishing a workout).
 */
export function useRestTimer() {
	const [state, setState] = useState<RestTimerState>(() => {
		// Resume from sentinel if one exists
		const sentinel = loadSentinel();
		if (sentinel) {
			const elapsed = Math.max(0, Math.floor((Date.now() - sentinel.startedAt) / 1000));
			return { exerciseIdx: sentinel.exerciseIdx, elapsed };
		}
		return { exerciseIdx: null, elapsed: 0 };
	});
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const startedAtRef = useRef<number | null>(null);

	const clearTimer = useCallback(() => {
		if (intervalRef.current !== null) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
	}, []);

	// Tick function that computes elapsed from the stored startedAt timestamp.
	// This avoids drift and correctly handles the browser throttling setInterval
	// when the tab is backgrounded.
	const startTicking = useCallback(
		(startedAt: number, exerciseIdx: number) => {
			clearTimer();
			startedAtRef.current = startedAt;
			intervalRef.current = setInterval(() => {
				const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
				setState({ exerciseIdx, elapsed });
			}, 1000);
		},
		[clearTimer],
	);

	// On mount, if we restored from a sentinel, kick off the interval
	useEffect(() => {
		const sentinel = loadSentinel();
		if (sentinel) {
			startedAtRef.current = sentinel.startedAt;
			startTicking(sentinel.startedAt, sentinel.exerciseIdx);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const start = useCallback(
		(exerciseIdx: number) => {
			const now = Date.now();
			clearTimer();
			startedAtRef.current = now;
			setState({ exerciseIdx, elapsed: 0 });
			saveSentinel({ exerciseIdx, startedAt: now });
			startTicking(now, exerciseIdx);
		},
		[clearTimer, startTicking],
	);

	const stop = useCallback(() => {
		clearTimer();
		startedAtRef.current = null;
		setState({ exerciseIdx: null, elapsed: 0 });
		clearSentinel();
	}, [clearTimer]);

	// Clean up interval on unmount (but don't clear sentinel — that's intentional
	// so the timer resumes if the component remounts).
	useEffect(() => {
		return () => clearTimer();
	}, [clearTimer]);

	return { ...state, start, stop };
}
