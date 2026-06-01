const SHEET_ID_COOKIE = 'stronger_sheet_id'
const TOKEN_COOKIE = 'stronger_token'

/** Cookie lifetime for the sheet ID: 1 year in seconds. */
const SHEET_ID_MAX_AGE = 365 * 24 * 60 * 60

/** Persist the spreadsheet ID in a long-lived cookie. */
export function saveSheetId(id: string): void {
	setCookie(SHEET_ID_COOKIE, id, SHEET_ID_MAX_AGE)
}

/** Read the stored spreadsheet ID, or `null` if not set. */
export function loadSheetId(): string | null {
	return getCookie(SHEET_ID_COOKIE)
}

/** Remove the stored spreadsheet ID. */
export function clearSheetId(): void {
	deleteCookie(SHEET_ID_COOKIE)
}

/* ------------------------------------------------------------------ */
/*  Calendar ID persistence (cookie-based)                             */
/* ------------------------------------------------------------------ */

const CALENDAR_ID_COOKIE = 'stronger_calendar_id'

/** Cookie lifetime for the calendar ID: 1 year in seconds. */
const CALENDAR_ID_MAX_AGE = 365 * 24 * 60 * 60

/** Persist the selected Google Calendar ID in a long-lived cookie. */
export function saveCalendarId(id: string): void {
	setCookie(CALENDAR_ID_COOKIE, id, CALENDAR_ID_MAX_AGE)
}

/** Read the stored calendar ID, or `null` if not set. */
export function loadCalendarId(): string | null {
	return getCookie(CALENDAR_ID_COOKIE)
}

/** Remove the stored calendar ID. */
export function clearCalendarId(): void {
	deleteCookie(CALENDAR_ID_COOKIE)
}

/* ------------------------------------------------------------------ */
/*  Cookie helpers                                                     */
/* ------------------------------------------------------------------ */

function setCookie(name: string, value: string, maxAgeSecs: number): void {
	document.cookie = `${name}=${encodeURIComponent(value)};max-age=${maxAgeSecs};path=/stronger/;SameSite=Strict;Secure`
}

function getCookie(name: string): string | null {
	const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
	return match ? decodeURIComponent(match[1]) : null
}

function deleteCookie(name: string): void {
	document.cookie = `${name}=;max-age=0;path=/stronger/;SameSite=Strict;Secure`
}

/* ------------------------------------------------------------------ */
/*  Token persistence (cookie-based)                                   */
/* ------------------------------------------------------------------ */

/** Buffer (seconds) to subtract from expires_in so the cookie expires slightly before the token. */
const TOKEN_EXPIRY_BUFFER = 300 // 5 minutes

/** Safe fallback lifetime when expires_in is not provided (Google tokens typically last 1 hour). */
const TOKEN_DEFAULT_LIFETIME = 3600

/** localStorage key for the token expiry timestamp (belt-and-suspenders alongside cookie max-age). */
const TOKEN_EXPIRY_KEY = 'stronger_token_expires_at'

/**
 * Persist the OAuth access token as a Secure, SameSite=Strict cookie.
 * The cookie max-age matches the actual token lifetime (minus a small
 * buffer) so the browser auto-deletes the cookie when the token expires.
 * This avoids restoring stale tokens on page reload, which would cause
 * a 401 round-trip and require a manual re-authentication click.
 */
export function saveToken(accessToken: string, expiresIn?: number): void {
	const lifetime = expiresIn ?? TOKEN_DEFAULT_LIFETIME
	// Ensure at least 60s so the cookie isn't immediately expired (e.g. if expiresIn ≤ buffer)
	const maxAge = Math.max(lifetime - TOKEN_EXPIRY_BUFFER, 60)
	setCookie(TOKEN_COOKIE, accessToken, maxAge)

	// Also save the expiry timestamp in localStorage as a secondary check
	// (guards against browsers that don't enforce cookie max-age precisely).
	try {
		const expiresAt = Date.now() + lifetime * 1000
		localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiresAt))
	} catch {
		// localStorage unavailable — cookie is the primary mechanism
	}
}

/**
 * Load the saved access token from the cookie.
 * Returns `null` if no token cookie exists (browser auto-expires it)
 * or if the localStorage expiry check indicates the token has expired.
 */
export function loadToken(): string | null {
	const token = getCookie(TOKEN_COOKIE)
	if (!token) return null

	// Double-check against stored expiry timestamp
	if (isTokenExpired()) {
		// Cookie exists but token has expired — clean up
		deleteCookie(TOKEN_COOKIE)
		clearTokenExpiry()
		return null
	}

	return token
}

/** Remove the stored access token cookie and expiry timestamp. */
export function clearToken(): void {
	deleteCookie(TOKEN_COOKIE)
	clearTokenExpiry()
}

/** Check whether the stored token has expired based on the localStorage timestamp. */
function isTokenExpired(): boolean {
	try {
		const expiresAt = localStorage.getItem(TOKEN_EXPIRY_KEY)
		if (!expiresAt) return false // No expiry recorded — trust the cookie
		return Date.now() >= Number(expiresAt)
	} catch {
		return false // localStorage unavailable — trust the cookie
	}
}

/** Remove the stored expiry timestamp. */
function clearTokenExpiry(): void {
	try {
		localStorage.removeItem(TOKEN_EXPIRY_KEY)
	} catch {
		// Ignore
	}
}
