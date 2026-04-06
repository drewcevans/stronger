import { useState, useEffect, useCallback, useRef } from 'react';

export interface RestTimerState {
	/** Index of the exercise whose header should display the timer, or null if inactive. */
	exerciseIdx: number | null;
	/** Elapsed seconds since the timer started. */
	elapsed: number;
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
 */
export function useRestTimer() {
	const [state, setState] = useState<RestTimerState>({
		exerciseIdx: null,
		elapsed: 0,
	});
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const clearTimer = useCallback(() => {
		if (intervalRef.current !== null) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
	}, []);

	const start = useCallback(
		(exerciseIdx: number) => {
			clearTimer();
			setState({ exerciseIdx, elapsed: 0 });
			intervalRef.current = setInterval(() => {
				setState((prev) => ({ ...prev, elapsed: prev.elapsed + 1 }));
			}, 1000);
		},
		[clearTimer],
	);

	const stop = useCallback(() => {
		clearTimer();
		setState({ exerciseIdx: null, elapsed: 0 });
	}, [clearTimer]);

	// Clean up on unmount
	useEffect(() => {
		return () => clearTimer();
	}, [clearTimer]);

	return { ...state, start, stop };
}
