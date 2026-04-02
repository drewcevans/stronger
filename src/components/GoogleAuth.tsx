import { useState, useEffect, useCallback } from 'react'
import type { Workout, LiftConfig } from '../model/index.ts'
import { defaultLiftConfigs, buildWorkoutsFromConfigs, workoutDefinitions } from '../data/sample-workouts.ts'
import type { WorkoutDefinition } from '../data/sample-workouts.ts'
import {
	loadGis,
	loadGapi,
	initGapiClient,
	signIn,
	signOut,
	hasToken,
	restoreToken,
	extractSheetId,
	saveSheetId,
	loadSheetId,
	clearSheetId,
	connectToSheet,
	readConfigZone,
	writeDefaultConfig,
	verifyWorkoutDefsTab,
	createWorkoutDefsTab,
	readWorkoutDefs,
	writeDefaultWorkoutDefs,
	GOOGLE_CLIENT_ID,
} from '../google/index.ts'

type Phase =
	| 'loading' // loading Google scripts
	| 'sign-in' // waiting for user to sign in
	| 'sheet-input' // signed in, need sheet URL
	| 'connecting' // verifying sheet access
	| 'connected' // ready to use
	| 'error' // something went wrong

interface Props {
	onConnected: (workouts: Workout[], configs: LiftConfig[], spreadsheetId: string, definitions: WorkoutDefinition[]) => void
	onDisconnected: () => void
}

export function GoogleAuth({ onConnected, onDisconnected }: Props) {
	const [phase, setPhase] = useState<Phase>('loading')
	const [error, setError] = useState<string | null>(null)
	const [sheetUrl, setSheetUrl] = useState('')
	const [sheetTitle, setSheetTitle] = useState<string | null>(null)

	/* ---------------------------------------------------------------- */
	/*  Load Google scripts on mount                                     */
	/* ---------------------------------------------------------------- */
	useEffect(() => {
		let cancelled = false

		async function init() {
			if (!GOOGLE_CLIENT_ID) {
				setError(
					'Google OAuth client ID is not configured. Set VITE_GOOGLE_CLIENT_ID in your environment.',
				)
				setPhase('error')
				return
			}
			try {
				await Promise.all([loadGis(), loadGapi()])
				await initGapiClient()
				if (cancelled) return

				// Restore a previously saved token (survives page reloads)
				restoreToken()

				// If gapi already has a token (e.g. same page session), skip sign-in
				if (hasToken()) {
					const storedId = loadSheetId()
					if (storedId) {
						setPhase('connecting')
						await tryConnect(storedId)
					} else {
						setPhase('sheet-input')
					}
				} else {
					setPhase('sign-in')
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : String(err))
					setPhase('error')
				}
			}
		}

		init()
		return () => {
			cancelled = true
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	/* ---------------------------------------------------------------- */
	/*  Helpers                                                          */
	/* ---------------------------------------------------------------- */

	const tryConnect = useCallback(async (spreadsheetId: string) => {
		try {
			setPhase('connecting')
			setError(null)
			const title = await connectToSheet(spreadsheetId)
			saveSheetId(spreadsheetId)
			setSheetTitle(title)

			// Read config zone — if empty, write defaults first
			let configs = await readConfigZone(spreadsheetId)
			if (!configs) {
				await writeDefaultConfig(spreadsheetId, defaultLiftConfigs)
				configs = defaultLiftConfigs
			}

			// Read workout defs — if tab missing or empty, create + write defaults
			const defsTabExists = await verifyWorkoutDefsTab(spreadsheetId)
			if (!defsTabExists) {
				await createWorkoutDefsTab(spreadsheetId)
			}

			// Build a lift-name lookup for exercise display names
			const liftNames = new Map(configs.map((c) => [c.id, c.name]))

			let defs = await readWorkoutDefs(spreadsheetId, liftNames)
			if (!defs) {
				await writeDefaultWorkoutDefs(spreadsheetId, workoutDefinitions)
				defs = workoutDefinitions
			}

			const workouts = buildWorkoutsFromConfigs(configs, defs)
			setPhase('connected')
			onConnected(workouts, configs, spreadsheetId, defs)
		} catch (err) {
			setError(
				err instanceof Error ? err.message : 'Unable to access the sheet.',
			)
			setPhase('error')
		}
	}, [onConnected])

	const handleSignIn = useCallback(async () => {
		try {
			setError(null)
			await signIn()
			// Signed in – check for stored sheet
			const storedId = loadSheetId()
			if (storedId) {
				await tryConnect(storedId)
			} else {
				setPhase('sheet-input')
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Sign-in failed.')
			setPhase('error')
		}
	}, [tryConnect])

	const handleSheetSubmit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault()
			const id = extractSheetId(sheetUrl)
			if (!id) {
				setError('That doesn\'t look like a Google Sheets URL.')
				return
			}
			setError(null)
			await tryConnect(id)
		},
		[sheetUrl, tryConnect],
	)

	const handleSignOut = useCallback(async () => {
		await signOut()
		clearSheetId()
		setSheetTitle(null)
		setSheetUrl('')
		setError(null)
		setPhase('sign-in')
		onDisconnected()
	}, [onDisconnected])

	const handleDisconnect = useCallback(() => {
		clearSheetId()
		setSheetTitle(null)
		setSheetUrl('')
		setError(null)
		setPhase('sheet-input')
		onDisconnected()
	}, [onDisconnected])

	/* ---------------------------------------------------------------- */
	/*  Render                                                           */
	/* ---------------------------------------------------------------- */

	if (phase === 'loading') {
		return (
			<div className="auth-screen">
				<p className="auth-status">Loading…</p>
			</div>
		)
	}

	if (phase === 'sign-in' || (phase === 'error' && !hasToken())) {
		return (
			<div className="auth-screen">
				<h1 className="app-title">Stronger</h1>
				<p className="subtitle">Sign in to connect your Google Sheet</p>
				{error && <p className="auth-error">{error}</p>}
				<button className="btn-google" onClick={handleSignIn}>
					Sign in with Google
				</button>
			</div>
		)
	}

	if (phase === 'sheet-input' || (phase === 'error' && !loadSheetId())) {
		return (
			<div className="auth-screen">
				<h1 className="app-title">Stronger</h1>
				<p className="subtitle">Paste your Google Sheet URL</p>
				{error && <p className="auth-error">{error}</p>}
				<form className="sheet-form" onSubmit={handleSheetSubmit}>
					<input
						className="sheet-url-input"
						type="url"
						placeholder="https://docs.google.com/spreadsheets/d/…"
						value={sheetUrl}
						onChange={(e) => setSheetUrl(e.target.value)}
						autoFocus
					/>
					<button className="btn-primary" type="submit">
						Connect
					</button>
				</form>
				<button className="btn-link" onClick={handleSignOut}>
					Sign out
				</button>
			</div>
		)
	}

	if (phase === 'connecting') {
		return (
			<div className="auth-screen">
				<p className="auth-status">Connecting to sheet…</p>
			</div>
		)
	}

	// phase === 'connected'
	return (
		<div className="auth-connected">
			<span className="sheet-name" title={sheetTitle ?? undefined}>
				📗 {sheetTitle}
			</span>
			<button className="btn-link" onClick={handleDisconnect}>
				Change sheet
			</button>
			<button className="btn-link" onClick={handleSignOut}>
				Sign out
			</button>
		</div>
	)
}
