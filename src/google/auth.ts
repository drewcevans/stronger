/**
 * Google OAuth authentication using Google Identity Services (GIS).
 *
 * This module handles the client-side implicit-grant OAuth flow.
 * It loads the GIS and gapi libraries, initialises a token client,
 * and exposes helpers for sign-in, sign-out, and token access.
 */

import { GOOGLE_CLIENT_ID, SHEETS_DISCOVERY_DOC, SHEETS_SCOPE } from './config.ts'
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

/** Initialise the gapi client and load Sheets discovery doc. */
export async function initGapiClient(): Promise<void> {
	if (gapiInited) return
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	await new Promise<void>((resolve) => gapi.load('client', resolve))
	await gapi.client.init({ discoveryDocs: [SHEETS_DISCOVERY_DOC] })
	gapiInited = true
}

/* ------------------------------------------------------------------ */
/*  Token client (GIS)                                                 */
/* ------------------------------------------------------------------ */

let tokenClient: TokenClient | null = null

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
		scope: SHEETS_SCOPE,
		callback: onToken,
	})
	return tokenClient
}

/* ------------------------------------------------------------------ */
/*  Sign-in / sign-out                                                 */
/* ------------------------------------------------------------------ */

/**
 * Prompt the user to sign in via Google OAuth.
 * Resolves with the access token on success.
 */
export function signIn(): Promise<string> {
	return new Promise((resolve, reject) => {
		const client = getTokenClient((resp) => {
			if (resp.error) {
				reject(new Error(resp.error_description ?? resp.error))
			} else {
				resolve(resp.access_token)
			}
		})
		client.requestAccessToken({ prompt: '' })
	})
}

/**
 * Sign out: revoke the current token and clear it from gapi.
 */
export function signOut(): Promise<void> {
	return new Promise<void>((resolve) => {
		const gapi = window.gapi
		const token = gapi?.client.getToken()
		if (token) {
			window.google?.accounts.oauth2.revoke(token.access_token, () => {
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
