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

	it('sets a 7-day max-age with security flags', () => {
		saveToken('tok_buf', 3600)
		const raw = setCalls[setCalls.length - 1]
		// 7 days = 604800 seconds
		expect(raw).toContain('max-age=604800')
		expect(raw).toContain('SameSite=Strict')
		expect(raw).toContain('Secure')
	})

	it('uses the same 7-day max-age regardless of expiresIn', () => {
		saveToken('tok_no_exp')
		const raw = setCalls[setCalls.length - 1]
		expect(raw).toContain('max-age=604800')
	})
})
