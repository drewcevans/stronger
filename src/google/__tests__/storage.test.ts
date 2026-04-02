import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { saveSheetId, loadSheetId, clearSheetId, saveToken, loadToken, clearToken } from '../storage.ts'

function mockLocalStorage() {
	const store = new Map<string, string>()
	return {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => store.set(key, value),
		removeItem: (key: string) => store.delete(key),
		clear: () => store.clear(),
	} as unknown as Storage
}

describe('sheet ID storage', () => {
	beforeEach(() => {
		vi.stubGlobal('localStorage', mockLocalStorage())
	})

	it('returns null when no sheet ID is stored', () => {
		expect(loadSheetId()).toBeNull()
	})

	it('persists and retrieves a sheet ID', () => {
		saveSheetId('abc123')
		expect(loadSheetId()).toBe('abc123')
	})

	it('overwrites a previously stored sheet ID', () => {
		saveSheetId('first')
		saveSheetId('second')
		expect(loadSheetId()).toBe('second')
	})

	it('clears the stored sheet ID', () => {
		saveSheetId('abc123')
		clearSheetId()
		expect(loadSheetId()).toBeNull()
	})
})

describe('token storage', () => {
	beforeEach(() => {
		vi.stubGlobal('localStorage', mockLocalStorage())
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('returns null when no token is stored', () => {
		expect(loadToken()).toBeNull()
	})

	it('persists and retrieves a token', () => {
		saveToken('tok_abc', 3600)
		expect(loadToken()).toBe('tok_abc')
	})

	it('returns null for an expired token', () => {
		saveToken('tok_expired', 60)
		// Advance past the 60-second expiry
		vi.advanceTimersByTime(61_000)
		expect(loadToken()).toBeNull()
	})

	it('returns the token before it expires', () => {
		saveToken('tok_valid', 3600)
		vi.advanceTimersByTime(1800_000) // 30 min into a 55 min effective window
		expect(loadToken()).toBe('tok_valid')
	})

	it('clears the stored token', () => {
		saveToken('tok_abc', 3600)
		clearToken()
		expect(loadToken()).toBeNull()
	})

	it('auto-clears expired token from storage on load', () => {
		saveToken('tok_old', 1)
		vi.advanceTimersByTime(2000)
		loadToken()
		// After loading an expired token, storage should be cleaned up
		expect(localStorage.getItem('stronger_token')).toBeNull()
		expect(localStorage.getItem('stronger_token_expiry')).toBeNull()
	})
})
