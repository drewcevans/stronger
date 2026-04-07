import { describe, expect, it, beforeEach, vi } from 'vitest'
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

describe('token storage (cookie)', () => {
	let cookieJar: string
	let setCalls: string[]

	function createCookieDoc() {
		const doc = { cookie: '' }
		Object.defineProperty(doc, 'cookie', {
			configurable: true,
			get: () => cookieJar,
			set: (v: string) => {
				setCalls.push(v)
				const [pair] = v.split(';')
				const [name] = pair.split('=')
				if (/max-age=0/i.test(v)) {
					const cookies = cookieJar.split('; ').filter(
						(c) => c && !c.startsWith(`${name}=`),
					)
					cookieJar = cookies.join('; ')
				} else {
					const cookies = cookieJar
						? cookieJar.split('; ').filter((c) => c && !c.startsWith(`${name}=`))
						: []
					cookies.push(pair)
					cookieJar = cookies.join('; ')
				}
			},
		})
		return doc
	}

	beforeEach(() => {
		cookieJar = ''
		setCalls = []
		vi.stubGlobal('document', createCookieDoc())
		vi.stubGlobal('localStorage', mockLocalStorage())
	})

	it('returns null when no token cookie exists', () => {
		expect(loadToken()).toBeNull()
	})

	it('persists and retrieves a token', () => {
		saveToken('tok_abc', 3600)
		expect(loadToken()).toBe('tok_abc')
	})

	it('clears the stored token', () => {
		saveToken('tok_abc', 3600)
		clearToken()
		expect(loadToken()).toBeNull()
	})

	it('sets max-age based on actual token expiry with security flags', () => {
		saveToken('tok_buf', 3600)
		const raw = setCalls[setCalls.length - 1]
		// 3600 - 300 (buffer) = 3300 seconds
		expect(raw).toContain('max-age=3300')
		expect(raw).toContain('SameSite=Strict')
		expect(raw).toContain('Secure')
	})

	it('uses default 1-hour lifetime when expiresIn is omitted', () => {
		saveToken('tok_no_exp')
		const raw = setCalls[setCalls.length - 1]
		// Default 3600 - 300 (buffer) = 3300 seconds
		expect(raw).toContain('max-age=3300')
	})

	it('returns null when localStorage expiry indicates token has expired', () => {
		saveToken('tok_expired', 3600)
		// Simulate the token having expired by backdating the localStorage entry
		localStorage.setItem('stronger_token_expires_at', String(Date.now() - 1000))
		expect(loadToken()).toBeNull()
	})

	it('clearToken also removes localStorage expiry', () => {
		saveToken('tok_clear', 3600)
		clearToken()
		expect(localStorage.getItem('stronger_token_expires_at')).toBeNull()
	})
})
