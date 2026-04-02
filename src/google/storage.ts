const SHEET_ID_KEY = 'stronger_sheet_id'
const TOKEN_KEY = 'stronger_token'
const TOKEN_EXPIRY_KEY = 'stronger_token_expiry'

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

/**
 * Persist the OAuth access token and its expiry timestamp.
 * `expiresIn` is the lifetime in seconds (from the token response).
 * We subtract a 5-minute buffer to avoid using a token right as it expires.
 */
export function saveToken(accessToken: string, expiresIn: number): void {
	localStorage.setItem(TOKEN_KEY, accessToken)
	const bufferSecs = 5 * 60
	const expiryMs = Date.now() + Math.max(0, expiresIn - bufferSecs) * 1000
	localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiryMs))
}

/**
 * Load the saved access token if it hasn't expired.
 * Returns `null` if no token is stored or it has expired.
 */
export function loadToken(): string | null {
	const token = localStorage.getItem(TOKEN_KEY)
	const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
	if (!token || !expiry) return null

	if (Date.now() >= Number(expiry)) {
		clearToken()
		return null
	}
	return token
}

/** Remove the stored access token and expiry. */
export function clearToken(): void {
	localStorage.removeItem(TOKEN_KEY)
	localStorage.removeItem(TOKEN_EXPIRY_KEY)
}
