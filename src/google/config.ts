/**
 * Google API configuration.
 *
 * Replace the client ID with your own from the Google Cloud Console.
 * The project must have the Google Sheets API enabled and an OAuth 2.0
 * client ID configured for a web application with the correct origins.
 */

/** OAuth 2.0 client ID from Google Cloud Console. */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

/** OAuth scope – read/write access to Google Sheets. */
export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'

/** Sheets API discovery document URL for gapi client initialization. */
export const SHEETS_DISCOVERY_DOC =
	'https://sheets.googleapis.com/$discovery/rest?version=v4'

/** Name of the tab the app targets inside the user's spreadsheet. */
export const TARGET_TAB_NAME = 'Stronger'
