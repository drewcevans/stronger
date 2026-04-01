/**
 * Extract a Google Sheets spreadsheet ID from a URL.
 *
 * Expected format:
 *   https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/...
 */

const SHEET_URL_PATTERN =
	/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/

/**
 * Extract the spreadsheet ID from a Google Sheets URL.
 * Returns `null` if the URL does not match the expected format.
 */
export function extractSheetId(url: string): string | null {
	const match = SHEET_URL_PATTERN.exec(url.trim())
	return match?.[1] ?? null
}
