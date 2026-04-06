/**
 * Garmin Sync — Strava → Google Sheets pipeline.
 *
 * Fetches recent activities from the Strava API and appends new rows
 * to the "Stronger - Garmin" tab in a Google Sheet. Uses a service
 * account for Sheets access and a Strava refresh token for API auth.
 *
 * Environment variables (all required):
 *   STRAVA_CLIENT_ID       – Strava API application client ID
 *   STRAVA_CLIENT_SECRET   – Strava API application client secret
 *   STRAVA_REFRESH_TOKEN   – long-lived refresh token (never expires)
 *   GOOGLE_SERVICE_ACCOUNT_KEY – JSON key for the Google service account
 *   SPREADSHEET_ID         – Google Sheets spreadsheet ID
 *
 * Usage:
 *   node scripts/garmin-sync.mjs
 */

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'
const STRAVA_ACTIVITIES_URL = 'https://www.strava.com/api/v3/athlete/activities'
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

const TAB_NAME = 'Stronger - Garmin'
const HEADER = ['date', 'stravaId', 'activityType', 'name', 'duration', 'distance', 'elevationGain', 'calories', 'avgHR', 'maxHR']
const COLUMN_COUNT = HEADER.length // 10 → columns A:J

// ---------------------------------------------------------------------------
// Strava OAuth2
// ---------------------------------------------------------------------------

async function refreshAccessToken(clientId, clientSecret, refreshToken) {
	const res = await fetch(STRAVA_TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			client_id: clientId,
			client_secret: clientSecret,
			grant_type: 'refresh_token',
			refresh_token: refreshToken,
		}),
	})
	if (!res.ok) {
		const text = await res.text()
		throw new Error(`Strava token refresh failed (${res.status}): ${text}`)
	}
	const data = await res.json()
	return data.access_token
}

// ---------------------------------------------------------------------------
// Strava Activities
// ---------------------------------------------------------------------------

async function fetchRecentActivities(accessToken, perPage = 30) {
	const url = new URL(STRAVA_ACTIVITIES_URL)
	url.searchParams.set('per_page', String(perPage))

	const res = await fetch(url.toString(), {
		headers: { Authorization: `Bearer ${accessToken}` },
	})
	if (!res.ok) {
		const text = await res.text()
		throw new Error(`Strava activities fetch failed (${res.status}): ${text}`)
	}
	return res.json()
}

function activityToRow(activity) {
	const date = activity.start_date_local
		? activity.start_date_local.slice(0, 10) // "YYYY-MM-DD"
		: ''
	return [
		date,
		String(activity.id ?? ''),
		activity.type ?? '',
		activity.name ?? '',
		String(activity.moving_time ?? 0),
		String(Math.round(activity.distance ?? 0)),
		String(Math.round(activity.total_elevation_gain ?? 0)),
		String(Math.round(activity.calories ?? 0)),
		String(Math.round(activity.average_heartrate ?? 0)),
		String(Math.round(activity.max_heartrate ?? 0)),
	]
}

// ---------------------------------------------------------------------------
// Google Sheets (service account via REST)
// ---------------------------------------------------------------------------

async function getGoogleAccessToken(serviceAccountKey) {
	// Build a JWT and exchange it for an access token.
	// We use the Web Crypto API (available in Node 20+) to sign the JWT.
	const key = typeof serviceAccountKey === 'string'
		? JSON.parse(serviceAccountKey)
		: serviceAccountKey

	const now = Math.floor(Date.now() / 1000)
	const header = { alg: 'RS256', typ: 'JWT' }
	const payload = {
		iss: key.client_email,
		scope: 'https://www.googleapis.com/auth/spreadsheets',
		aud: 'https://oauth2.googleapis.com/token',
		iat: now,
		exp: now + 3600,
	}

	const enc = new TextEncoder()
	const b64url = (buf) =>
		Buffer.from(buf).toString('base64url')

	const headerB64 = b64url(enc.encode(JSON.stringify(header)))
	const payloadB64 = b64url(enc.encode(JSON.stringify(payload)))
	const unsignedToken = `${headerB64}.${payloadB64}`

	// Import the PEM private key
	const pemBody = key.private_key
		.replace(/-----BEGIN PRIVATE KEY-----/, '')
		.replace(/-----END PRIVATE KEY-----/, '')
		.replace(/\s/g, '')
	const binaryKey = Buffer.from(pemBody, 'base64')
	const cryptoKey = await crypto.subtle.importKey(
		'pkcs8',
		binaryKey,
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['sign'],
	)
	const signature = await crypto.subtle.sign(
		'RSASSA-PKCS1-v1_5',
		cryptoKey,
		enc.encode(unsignedToken),
	)
	const jwt = `${unsignedToken}.${b64url(new Uint8Array(signature))}`

	const res = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion: jwt,
		}),
	})
	if (!res.ok) {
		const text = await res.text()
		throw new Error(`Google token exchange failed (${res.status}): ${text}`)
	}
	const data = await res.json()
	return data.access_token
}

async function ensureTab(spreadsheetId, googleToken) {
	// Check if the tab exists
	const metaRes = await fetch(
		`${SHEETS_API_BASE}/${spreadsheetId}?fields=sheets.properties.title`,
		{ headers: { Authorization: `Bearer ${googleToken}` } },
	)
	if (!metaRes.ok) {
		const text = await metaRes.text()
		throw new Error(`Sheets metadata fetch failed (${metaRes.status}): ${text}`)
	}
	const meta = await metaRes.json()
	const exists = (meta.sheets ?? []).some(
		(s) => s.properties?.title === TAB_NAME,
	)
	if (exists) return

	// Create tab
	const createRes = await fetch(
		`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`,
		{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${googleToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				requests: [{ addSheet: { properties: { title: TAB_NAME } } }],
			}),
		},
	)
	if (!createRes.ok) {
		const text = await createRes.text()
		throw new Error(`Tab creation failed (${createRes.status}): ${text}`)
	}

	// Write header
	const colLetter = String.fromCharCode(64 + COLUMN_COUNT)
	const headerRange = encodeURIComponent(`'${TAB_NAME}'!A1:${colLetter}1`)
	const headerRes = await fetch(
		`${SHEETS_API_BASE}/${spreadsheetId}/values/${headerRange}?valueInputOption=RAW`,
		{
			method: 'PUT',
			headers: {
				Authorization: `Bearer ${googleToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ values: [HEADER] }),
		},
	)
	if (!headerRes.ok) {
		const text = await headerRes.text()
		throw new Error(`Header write failed (${headerRes.status}): ${text}`)
	}
	console.log('Created "Stronger - Garmin" tab with header row.')
}

async function readExistingIds(spreadsheetId, googleToken) {
	// Read the stravaId column (column B, starting from row 2)
	const range = encodeURIComponent(`'${TAB_NAME}'!B2:B`)
	const res = await fetch(
		`${SHEETS_API_BASE}/${spreadsheetId}/values/${range}`,
		{ headers: { Authorization: `Bearer ${googleToken}` } },
	)
	if (!res.ok) {
		const text = await res.text()
		throw new Error(`Read existing IDs failed (${res.status}): ${text}`)
	}
	const data = await res.json()
	const ids = new Set()
	for (const row of data.values ?? []) {
		if (row[0]) ids.add(row[0].trim())
	}
	return ids
}

async function appendRows(spreadsheetId, googleToken, rows) {
	if (rows.length === 0) return
	const colLetter = String.fromCharCode(64 + COLUMN_COUNT)
	const range = encodeURIComponent(`'${TAB_NAME}'!A:${colLetter}`)
	const res = await fetch(
		`${SHEETS_API_BASE}/${spreadsheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
		{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${googleToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ values: rows }),
		},
	)
	if (!res.ok) {
		const text = await res.text()
		throw new Error(`Append rows failed (${res.status}): ${text}`)
	}
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	const {
		STRAVA_CLIENT_ID,
		STRAVA_CLIENT_SECRET,
		STRAVA_REFRESH_TOKEN,
		GOOGLE_SERVICE_ACCOUNT_KEY,
		SPREADSHEET_ID,
	} = process.env

	if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_REFRESH_TOKEN) {
		throw new Error('Missing Strava environment variables (STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN)')
	}
	if (!GOOGLE_SERVICE_ACCOUNT_KEY) {
		throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY environment variable')
	}
	if (!SPREADSHEET_ID) {
		throw new Error('Missing SPREADSHEET_ID environment variable')
	}

	// 1. Authenticate with Strava
	console.log('Refreshing Strava access token...')
	const stravaToken = await refreshAccessToken(
		STRAVA_CLIENT_ID,
		STRAVA_CLIENT_SECRET,
		STRAVA_REFRESH_TOKEN,
	)

	// 2. Fetch recent activities
	console.log('Fetching recent activities from Strava...')
	const activities = await fetchRecentActivities(stravaToken, 30)
	console.log(`Fetched ${activities.length} activities from Strava.`)

	// 3. Authenticate with Google Sheets
	console.log('Authenticating with Google Sheets...')
	const googleToken = await getGoogleAccessToken(GOOGLE_SERVICE_ACCOUNT_KEY)

	// 4. Ensure tab exists
	await ensureTab(SPREADSHEET_ID, googleToken)

	// 5. Read existing Strava IDs for deduplication
	const existingIds = await readExistingIds(SPREADSHEET_ID, googleToken)
	console.log(`Found ${existingIds.size} existing activities in sheet.`)

	// 6. Convert and filter new activities
	const newRows = activities
		.map(activityToRow)
		.filter((row) => !existingIds.has(row[1])) // row[1] = stravaId

	if (newRows.length === 0) {
		console.log('No new activities to sync.')
		return
	}

	// 7. Append new rows
	console.log(`Appending ${newRows.length} new activities...`)
	await appendRows(SPREADSHEET_ID, googleToken, newRows)
	console.log(`Done — synced ${newRows.length} new activities.`)
}

main().catch((err) => {
	console.error('Garmin sync failed:', err.message)
	process.exit(1)
})
