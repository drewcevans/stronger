import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { loadDraft, saveDraft, clearDraft } from '../../hooks/useWorkoutDraft.js';
import type { WorkoutDraft } from '../../hooks/useWorkoutDraft.js';

function makeDraft(overrides?: Partial<WorkoutDraft>): WorkoutDraft {
	return {
		workoutId: 'rss-bench',
		startTime: '2026-04-06T10:00:00.000Z',
		results: [
			[
				{ actualWeight: 135, actualReps: 5, completed: true, actualSetType: 'warmup' },
				{ actualWeight: 200, actualReps: 3, completed: false, actualSetType: 'work' },
			],
		],
		...overrides,
	};
}

// Minimal localStorage mock (vitest runs without a DOM by default)
function mockLocalStorage() {
	const store = new Map<string, string>();
	const mock = {
		getItem: vi.fn((key: string) => store.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => { store.set(key, value); }),
		removeItem: vi.fn((key: string) => { store.delete(key); }),
		clear: vi.fn(() => { store.clear(); }),
		get length() { return store.size; },
		key: vi.fn((_i: number) => null),
	};
	Object.defineProperty(globalThis, 'localStorage', { value: mock, writable: true, configurable: true });
	return mock;
}

describe('workout draft persistence', () => {
	let storage: ReturnType<typeof mockLocalStorage>;

	beforeEach(() => {
		storage = mockLocalStorage();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns null when no draft exists', () => {
		expect(loadDraft()).toBeNull();
	});

	it('persists and retrieves a draft', () => {
		const draft = makeDraft();
		saveDraft(draft);
		expect(loadDraft()).toEqual(draft);
	});

	it('clears the draft', () => {
		saveDraft(makeDraft());
		clearDraft();
		expect(loadDraft()).toBeNull();
	});

	it('overwrites a previous draft', () => {
		saveDraft(makeDraft({ workoutId: 'old-workout' }));
		const newDraft = makeDraft({ workoutId: 'new-workout' });
		saveDraft(newDraft);
		expect(loadDraft()).toEqual(newDraft);
	});

	it('returns null for corrupt JSON', () => {
		localStorage.setItem('stronger_workout_draft', '{bad json');
		expect(loadDraft()).toBeNull();
	});

	it('returns null for a non-object value', () => {
		localStorage.setItem('stronger_workout_draft', '"just a string"');
		expect(loadDraft()).toBeNull();
	});

	it('returns null when workoutId is missing', () => {
		localStorage.setItem(
			'stronger_workout_draft',
			JSON.stringify({ startTime: '2026-01-01T00:00:00Z', results: [] }),
		);
		expect(loadDraft()).toBeNull();
	});

	it('returns null when results contains invalid set data', () => {
		localStorage.setItem(
			'stronger_workout_draft',
			JSON.stringify({
				workoutId: 'x',
				startTime: '2026-01-01T00:00:00Z',
				results: [[{ actualWeight: 100 }]], // missing fields
			}),
		);
		expect(loadDraft()).toBeNull();
	});

	it('accepts a draft with empty results array', () => {
		const draft = makeDraft({ results: [] });
		saveDraft(draft);
		expect(loadDraft()).toEqual(draft);
	});

	it('preserves multiple exercises with multiple sets', () => {
		const draft = makeDraft({
			results: [
				[
					{ actualWeight: 100, actualReps: 5, completed: true, actualSetType: 'warmup' },
					{ actualWeight: 200, actualReps: 3, completed: true, actualSetType: 'work' },
				],
				[
					{ actualWeight: 50, actualReps: 10, completed: false, actualSetType: 'backoff' },
				],
			],
		});
		saveDraft(draft);
		expect(loadDraft()).toEqual(draft);
	});
});
