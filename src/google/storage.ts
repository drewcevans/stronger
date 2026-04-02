const SHEET_ID_KEY = 'stronger_sheet_id'
const TOKEN_COOKIE = 'stronger_token'

/** Persist the spreadsheet ID in local storage. */
export function saveSheetId(id: string): void {
	localStorage.setItem(SHEET_ID_KEY, id)
}

/** Read the stored spreadsheet ID, or `null` if not set. */
export function loadSheetId(): string | null {
	return localStorage.getItem(SHEET_ID_KEY)
}

/** Remove the stored spreadsheet ID. */
export function clearSheetId(): void {
	localStorage.removeItem(SHEET_ID_KEY)
}

/* ------------------------------------------------------------------ */
/*  Cookie helpers                                                     */
/* ------------------------------------------------------------------ */

function setCookie(name: string, value: string, maxAgeSecs: number): void {
	document.cookie = `${name}=${encodeURIComponent(value)};max-age=${maxAgeSecs};path=/;SameSite=Strict;Secure`
}

function getCookie(name: string): string | null {
	const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
	return match ? decodeURIComponent(match[1]) : null
}

function deleteCookie(name: string): void {
	document.cookie = `${name}=;max-age=0;path=/;SameSite=Strict;Secure`
}

/* ------------------------------------------------------------------ */
/*  Token persistence (cookie-based)                                   */
/* ------------------------------------------------------------------ */

/**
 * Persist the OAuth access token as a Secure, SameSite=Strict cookie.
 * `expiresIn` is the lifetime in seconds (from the token response).
 * We subtract a 5-minute buffer to avoid using a token right as it expires.
 */
export function saveToken(accessToken: string, expiresIn: number): void {
	const bufferSecs = 5 * 60
	const maxAge = Math.max(0, expiresIn - bufferSecs)
	setCookie(TOKEN_COOKIE, accessToken, maxAge)
}

/**
 * Load the saved access token from the cookie.
 * Returns `null` if no token cookie exists (browser auto-expires it).
 */
export function loadToken(): string | null {
	return getCookie(TOKEN_COOKIE)
}

/** Remove the stored access token cookie. */
export function clearToken(): void {
	deleteCookie(TOKEN_COOKIE)
}
