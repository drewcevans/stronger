/**
 * Google Sheets API helpers.
 *
 * Verifies access to a spreadsheet and ensures the "Stronger" tab exists.
 */

import { TARGET_TAB_NAME } from './config.ts'

/* ------------------------------------------------------------------ */
/*  Sheet access verification                                          */
/* ------------------------------------------------------------------ */

export interface SheetInfo {
	title: string
	strongerTabExists: boolean
}

/**
 * Verify that the authenticated user can access the given spreadsheet.
 * Returns basic metadata including whether the target tab already exists.
 *
 * Throws if the sheet is inaccessible or the API call fails.
 */
export async function verifySheetAccess(
	spreadsheetId: string,
): Promise<SheetInfo> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	const response = await gapi.client.sheets.spreadsheets.get({
		spreadsheetId,
	})
	const sheets = response.result.sheets ?? []
	const strongerTabExists = sheets.some(
		(s) => s.properties.title === TARGET_TAB_NAME,
	)
	return {
		title: response.result.properties.title,
		strongerTabExists,
	}
}

/* ------------------------------------------------------------------ */
/*  Tab creation                                                       */
/* ------------------------------------------------------------------ */

/**
 * Create the "Stronger" tab inside the given spreadsheet.
 * This is a no-op if the tab already exists (callers should check first).
 */
export async function createStrongerTab(
	spreadsheetId: string,
): Promise<void> {
	const gapi = window.gapi
	if (!gapi) throw new Error('gapi not loaded')

	await gapi.client.sheets.spreadsheets.batchUpdate({
		spreadsheetId,
		resource: {
			requests: [{ addSheet: { properties: { title: TARGET_TAB_NAME } } }],
		},
	})
}

/* ------------------------------------------------------------------ */
/*  Combined connect flow                                              */
/* ------------------------------------------------------------------ */

/**
 * High-level helper: verify sheet access and ensure the "Stronger" tab
 * exists. Returns the spreadsheet title.
 */
export async function connectToSheet(spreadsheetId: string): Promise<string> {
	const info = await verifySheetAccess(spreadsheetId)
	if (!info.strongerTabExists) {
		await createStrongerTab(spreadsheetId)
	}
	return info.title
}
