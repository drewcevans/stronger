/**
 * Google OAuth authentication using Google Identity Services (GIS).
 *
 * This module handles the client-side implicit-grant OAuth flow.
 * It loads the GIS and gapi libraries, initialises a token client,
 * and exposes helpers for sign-in, sign-out, and token access.
 */

import { GOOGLE_CLIENT_ID, SHEETS_DISCOVERY_DOC, CALENDAR_DISCOVERY_DOC, OAUTH_SCOPES } from './config.ts'
import { saveToken, loadToken, clearToken } from './storage.ts'
import type { TokenClient, TokenResponse } from './types.ts'

/* ------------------------------------------------------------------ */
/*  Script-loading helpers                                             */
/* ------------------------------------------------------------------ */

function loadScript(src: string): Promise<void> {
	return new Promise((resolve, reject) => {
		if (document.querySelector(`script[src="${src}"]`)) {
			resolve()
			return
		}
		const el = document.createElement('script')
		el.src = src
		el.async = true
		el.defer = true
		el.onload = () => resolve()
		el.onerror = () => reject(new Error(`Failed to load script: ${src}`))
		document.head.appendChild(el)
	})
}

/** Load Google Identity Services library. */
export function loadGis(): Promise<void> {
	return loadScript('https://accounts.google.com/gsi/client')
}

/** Load gapi client library. */
export function loadGapi(): Promise<void> {
	return loadScript('https://apis.google.com/js/api.js')
}

/* ------------------------------------------------------------------ */
/*  gapi client initialisation                                        */
/* ------------------------------------------------------------------ */

let gapiInited = false

/** Initialise the gapi client and load Sheets + Calendar discovery docs. */
export async function initGapiClient(): Promise<void> {
	if (gapiInited) return
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	await new Promise<void>((resolve) => gapi.load('client', resolve))
	await gapi.client.init({ discoveryDocs: [SHEETS_DISCOVERY_DOC, CALENDAR_DISCOVERY_DOC] })
	gapiInited = true
}

/* ------------------------------------------------------------------ */
/*  Token client (GIS)                                                 */
/* ------------------------------------------------------------------ */

let tokenClient: TokenClient | null = null

/**
 * Handler invoked by GIS when the OAuth flow itself fails (e.g. user
 * closes the popup, popup blocked, or other pre-consent errors).
 * Set by `signIn()` so the promise can be rejected.
 */
let pendingErrorHandler: ((err: Error) => void) | null = null

/**
 * Create (or return existing) GIS token client.
 *
 * `onToken` is called each time the user completes authentication.
 */
export function getTokenClient(
	onToken: (response: TokenResponse) => void,
): TokenClient {
	if (tokenClient) {
		tokenClient.callback = onToken
		return tokenClient
	}

	const google = window.google
	if (!google) throw new Error('Google Identity Services not loaded')

	tokenClient = google.accounts.oauth2.initTokenClient({
		client_id: GOOGLE_CLIENT_ID,
		scope: OAUTH_SCOPES,
		callback: onToken,
		error_callback: (err) => {
			if (pendingErrorHandler) {
				pendingErrorHandler(
					new Error(err.message ?? err.type ?? 'Authentication flow failed'),
				)
				pendingErrorHandler = null
			}
		},
	})
	return tokenClient
}

/* ------------------------------------------------------------------ */
/*  Sign-in / sign-out                                                 */
/* ------------------------------------------------------------------ */

/** Timeout for the sign-in promise (ms). */
const SIGN_IN_TIMEOUT_MS = 60_000

/**
 * Prompt the user to sign in via Google OAuth.
 * Resolves with the access token on success.
 *
 * The promise will reject if:
 * - the user closes the popup / denies consent (via GIS error_callback)
 * - GIS returns an error in the token response
 * - the flow doesn't complete within 60 seconds
 */
export function signIn(): Promise<string> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			pendingErrorHandler = null
			reject(new Error('Sign-in timed out. Please try again.'))
		}, SIGN_IN_TIMEOUT_MS)

		pendingErrorHandler = (err) => {
			clearTimeout(timer)
			reject(err)
		}

		const client = getTokenClient((resp) => {
			clearTimeout(timer)
			pendingErrorHandler = null
			if (resp.error) {
				reject(new Error(resp.error_description ?? resp.error))
			} else {
				saveToken(resp.access_token, resp.expires_in)
				resolve(resp.access_token)
			}
		})
		client.requestAccessToken({ prompt: '' })
	})
}

/** Timeout for the revoke call (ms). */
const REVOKE_TIMEOUT_MS = 5_000

/**
 * Sign out: revoke the current token and clear it from gapi.
 */
export function signOut(): Promise<void> {
	return new Promise<void>((resolve) => {
		clearToken()
		const gapi = window.gapi
		const token = gapi?.client.getToken()
		if (token) {
			const timer = setTimeout(() => {
				gapi?.client.setToken(null)
				resolve()
			}, REVOKE_TIMEOUT_MS)

			window.google?.accounts.oauth2.revoke(token.access_token, () => {
				clearTimeout(timer)
				gapi?.client.setToken(null)
				resolve()
			})
		} else {
			resolve()
		}
	})
}

/** Check whether gapi currently holds an access token. */
export function hasToken(): boolean {
	return window.gapi?.client.getToken() != null
}

/**
 * Restore a previously saved access token into gapi.
 * Returns `true` if a valid (non-expired) token was restored.
 */
export function restoreToken(): boolean {
	const accessToken = loadToken()
	if (!accessToken) return false

	const gapi = window.gapi
	if (!gapi) return false

	gapi.client.setToken({ access_token: accessToken })
	return true
}

/**
 * Clear a stale token from both the cookie and gapi client.
 * Use when a stored token turns out to be expired / revoked.
 */
export function clearAuth(): void {
	clearToken()
	window.gapi?.client.setToken(null)
}

/**
 * Check whether an error thrown by gapi.client is a 401 auth error,
 * indicating the access token has expired or been revoked.
 */
export function isAuthError(err: unknown): boolean {
	if (err && typeof err === 'object') {
		const e = err as Record<string, unknown>
		if (e.status === 401) return true
		const result = e.result as Record<string, unknown> | undefined
		if (result?.error) {
			const apiError = result.error as Record<string, unknown>
			if (apiError.code === 401) return true
		}
	}
	return false
}
