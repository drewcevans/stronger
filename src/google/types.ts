/**
 * Minimal type declarations for the Google Identity Services (GIS) library
 * and the gapi Sheets client used by this app.
 *
 * These cover only the surface area we actually use so we don't need the
 * full @types/gapi packages as dependencies.
 */

/* ------------------------------------------------------------------ */
/*  Google Identity Services (loaded from accounts.google.com/gsi)    */
/* ------------------------------------------------------------------ */

export interface TokenResponse {
	access_token: string
	expires_in: number
	scope: string
	token_type: string
	error?: string
	error_description?: string
}

export interface TokenClient {
	requestAccessToken: (opts?: { prompt?: string }) => void
	callback: (response: TokenResponse) => void
}

export interface TokenClientConfig {
	client_id: string
	scope: string
	callback: (response: TokenResponse) => void
}

export interface GoogleAccountsOAuth2 {
	initTokenClient: (config: TokenClientConfig) => TokenClient
	revoke: (token: string, done?: () => void) => void
}

/* ------------------------------------------------------------------ */
/*  gapi client (loaded from apis.google.com/js/api.js)               */
/* ------------------------------------------------------------------ */

export interface ValuesGetResponse {
	result: {
		range: string
		majorDimension: string
		values?: string[][]
	}
}

export interface ValuesUpdateResponse {
	result: {
		spreadsheetId: string
		updatedRange: string
		updatedRows: number
		updatedColumns: number
		updatedCells: number
	}
}

export interface ValuesAppendResponse {
	result: {
		spreadsheetId: string
		updates: {
			updatedRange: string
			updatedRows: number
			updatedColumns: number
			updatedCells: number
		}
	}
}

export interface GapiClient {
	init: (config: { discoveryDocs: string[] }) => Promise<void>
	getToken: () => { access_token: string } | null
	setToken: (token: { access_token: string } | null) => void
	sheets: {
		spreadsheets: {
			create: (params: {
				resource: {
					properties: { title: string }
				}
			}) => Promise<SpreadsheetsGetResponse>
			get: (params: {
				spreadsheetId: string
			}) => Promise<SpreadsheetsGetResponse>
			batchUpdate: (params: {
				spreadsheetId: string
				resource: { requests: SheetRequest[] }
			}) => Promise<unknown>
			values: {
				get: (params: {
					spreadsheetId: string
					range: string
				}) => Promise<ValuesGetResponse>
				update: (params: {
					spreadsheetId: string
					range: string
					valueInputOption: string
					resource: { values: (string | number)[][] }
				}) => Promise<ValuesUpdateResponse>
				append: (params: {
					spreadsheetId: string
					range: string
					valueInputOption: string
					insertDataOption?: string
					resource: { values: (string | number | boolean)[][] }
				}) => Promise<ValuesAppendResponse>
				clear: (params: {
					spreadsheetId: string
					range: string
				}) => Promise<unknown>
			}
		}
	}
	calendar: {
		calendarList: {
			list: () => Promise<CalendarListResponse>
		}
		events: {
			insert: (params: {
				calendarId: string
				resource: CalendarEventResource
			}) => Promise<CalendarEventResponse>
		}
	}
}

export interface Gapi {
	load: (lib: string, callback: () => void) => void
	client: GapiClient
}

/* ------------------------------------------------------------------ */
/*  Sheets API response types                                          */
/* ------------------------------------------------------------------ */

export interface SheetProperties {
	sheetId: number
	title: string
	index: number
}

export interface SpreadsheetsGetResponse {
	result: {
		spreadsheetId: string
		properties: { title: string }
		sheets: Array<{ properties: SheetProperties }>
	}
}

export interface SheetRequest {
	addSheet?: {
		properties: {
			title: string
		}
	}
	deleteDimension?: {
		range: {
			sheetId: number
			dimension: 'ROWS' | 'COLUMNS'
			startIndex: number
			endIndex: number
		}
	}
}

/* ------------------------------------------------------------------ */
/*  Calendar API types                                                 */
/* ------------------------------------------------------------------ */

export interface CalendarListEntry {
	id: string
	summary: string
	primary?: boolean
	accessRole: 'freeBusyReader' | 'reader' | 'writer' | 'owner'
}

export interface CalendarListResponse {
	result: {
		items: CalendarListEntry[]
	}
}

export interface CalendarEventResource {
	summary: string
	description?: string
	start: { date: string }
	end: { date: string }
}

export interface CalendarEventResponse {
	result: {
		id: string
		htmlLink: string
	}
}

/* ------------------------------------------------------------------ */
/*  Global augmentations                                               */
/* ------------------------------------------------------------------ */

declare global {
	interface Window {
		google?: {
			accounts: {
				oauth2: GoogleAccountsOAuth2
			}
		}
		gapi?: Gapi
	}
}
