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

/** Cookie lifetime: 7 days in seconds. */
const TOKEN_MAX_AGE = 7 * 24 * 60 * 60

/**
 * Persist the OAuth access token as a Secure, SameSite=Strict cookie.
 * The cookie lives for 7 days so the user isn't prompted to sign in
 * on every visit. If the token expires at Google's end before then,
 * the next API call will fail and the sign-in flow will re-trigger.
 */
export function saveToken(accessToken: string, _expiresIn?: number): void {
	setCookie(TOKEN_COOKIE, accessToken, TOKEN_MAX_AGE)
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
