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

/** Name of the tab the app targets for lift configurations. */
export const TARGET_TAB_NAME = 'Stronger - Exercises'

/** Name of the tab that holds workout definitions (exercise structure). */
export const WORKOUT_DEFS_TAB_NAME = 'Stronger - Workouts'

/** Name of the tab that holds the workout log (completed set data). */
export const LOG_TAB_NAME = 'Stronger - Log'

/** Name of the tab that holds the workout schedule (date→workoutId mapping). */
export const SCHEDULE_TAB_NAME = 'Stronger - Schedule'
