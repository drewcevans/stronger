import { describe, it, expect, beforeEach, vi } from 'vitest';
import { formatElapsed, resolveTimerExercise, loadSentinel, clearSentinel } from '../useRestTimer.js';

const SENTINEL_KEY = 'stronger_rest_timer';

// Provide a minimal localStorage for Node/jsdom test environments
const store: Record<string, string> = {};
beforeEach(() => {
	// Reset our polyfill store
	for (const key of Object.keys(store)) delete store[key];
	if (typeof globalThis.localStorage === 'undefined') {
		Object.defineProperty(globalThis, 'localStorage', {
			value: {
				getItem: (k: string) => store[k] ?? null,
				setItem: (k: string, v: string) => { store[k] = v; },
				removeItem: (k: string) => { delete store[k]; },
			},
			configurable: true,
		});
	} else {
		// Remove just our key to avoid issues with minimal localStorage polyfills
		try { localStorage.removeItem(SENTINEL_KEY); } catch { /* ignore */ }
	}
});

describe('formatElapsed', () => {
	it('formats zero seconds', () => {
		expect(formatElapsed(0)).toBe('0:00');
	});

	it('formats seconds under a minute', () => {
		expect(formatElapsed(5)).toBe('0:05');
		expect(formatElapsed(45)).toBe('0:45');
	});

	it('formats exact minutes', () => {
		expect(formatElapsed(60)).toBe('1:00');
		expect(formatElapsed(120)).toBe('2:00');
	});

	it('formats minutes and seconds', () => {
		expect(formatElapsed(105)).toBe('1:45');
		expect(formatElapsed(723)).toBe('12:03');
	});

	it('pads seconds to two digits', () => {
		expect(formatElapsed(61)).toBe('1:01');
		expect(formatElapsed(9)).toBe('0:09');
	});
});

describe('resolveTimerExercise', () => {
	// totalSetsPerExercise: [3, 4, 2] means exercise 0 has 3 sets, exercise 1 has 4, exercise 2 has 2

	it('returns current exercise for non-last set', () => {
		expect(resolveTimerExercise(0, 0, [3, 4, 2])).toBe(0);
		expect(resolveTimerExercise(0, 1, [3, 4, 2])).toBe(0);
		expect(resolveTimerExercise(1, 2, [3, 4, 2])).toBe(1);
	});

	it('returns next exercise when last set of non-last exercise', () => {
		expect(resolveTimerExercise(0, 2, [3, 4, 2])).toBe(1);
		expect(resolveTimerExercise(1, 3, [3, 4, 2])).toBe(2);
	});

	it('returns current exercise when last set of last exercise', () => {
		expect(resolveTimerExercise(2, 1, [3, 4, 2])).toBe(2);
	});

	it('handles single-exercise workout', () => {
		expect(resolveTimerExercise(0, 0, [3])).toBe(0); // not last set
		expect(resolveTimerExercise(0, 2, [3])).toBe(0); // last set, last exercise
	});

	it('handles single-set exercises', () => {
		expect(resolveTimerExercise(0, 0, [1, 1, 1])).toBe(1);
		expect(resolveTimerExercise(1, 0, [1, 1, 1])).toBe(2);
		expect(resolveTimerExercise(2, 0, [1, 1, 1])).toBe(2); // last exercise
	});
});

describe('timer sentinel persistence', () => {
	it('loadSentinel returns null when no sentinel exists', () => {
		expect(loadSentinel()).toBeNull();
	});

	it('loadSentinel returns null for invalid JSON', () => {
		localStorage.setItem(SENTINEL_KEY, 'not-json');
		expect(loadSentinel()).toBeNull();
	});

	it('loadSentinel returns null for malformed data', () => {
		localStorage.setItem(SENTINEL_KEY, JSON.stringify({ exerciseIdx: 'bad' }));
		expect(loadSentinel()).toBeNull();
	});

	it('loadSentinel returns valid sentinel', () => {
		const sentinel = { exerciseIdx: 2, startedAt: 1700000000000 };
		localStorage.setItem(SENTINEL_KEY, JSON.stringify(sentinel));
		expect(loadSentinel()).toEqual(sentinel);
	});

	it('clearSentinel removes the sentinel', () => {
		localStorage.setItem(SENTINEL_KEY, JSON.stringify({ exerciseIdx: 0, startedAt: Date.now() }));
		clearSentinel();
		expect(localStorage.getItem(SENTINEL_KEY)).toBeNull();
	});
});
