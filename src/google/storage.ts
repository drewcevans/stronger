const SHEET_ID_KEY = 'stronger_sheet_id'

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
