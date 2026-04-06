import { useState, useEffect, useCallback } from 'react'
import type { Workout, LiftConfig, CardioActivity } from '../model/index.ts'
import { buildWorkoutsFromConfigs, workoutDefinitions } from '../data/sample-workouts.ts'
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
	createSpreadsheet,
	connectToSheet,
	readConfigZone,
	verifyWorkoutDefsTab,
	createWorkoutDefsTab,
	readWorkoutDefs,
	writeDefaultWorkoutDefs,
	verifyLogTab,
	createLogTab,
	verifyCardioTab,
	createCardioTab,
	readCardioActivities,
	writeDefaultCardioActivities,
	GOOGLE_CLIENT_ID,
} from '../google/index.ts'
import { defaultCardioActivities } from '../data/sample-workouts.ts'
import { Dumbbell, Calendar, LogOut, Library, TrendingUp, Settings, Activity } from 'lucide-react'

type Phase =
	| 'loading' // loading Google scripts
	| 'sign-in' // waiting for user to sign in
	| 'sheet-input' // signed in, need sheet URL
	| 'connecting' // verifying sheet access
	| 'connected' // ready to use
	| 'error' // something went wrong

interface Props {
	onConnected: (workouts: Workout[], configs: LiftConfig[], spreadsheetId: string, definitions: WorkoutDefinition[], cardioActivities: CardioActivity[]) => void
	onDisconnected: () => void
	onNeedsSetup?: (spreadsheetId: string) => void
	onOpenCalendar?: () => void
	onOpenExercises?: () => void
	onOpenProgress?: () => void
	onOpenGarmin?: () => void
	onOpenSettings?: () => void
	onGoToList?: () => void
}

export function GoogleAuth({ onConnected, onDisconnected, onNeedsSetup, onOpenCalendar, onOpenExercises, onOpenProgress, onOpenGarmin, onOpenSettings, onGoToList }: Props) {
	const [phase, setPhase] = useState<Phase>('loading')
	const [error, setError] = useState<string | null>(null)
	const [sheetUrl, setSheetUrl] = useState('')
	const [sheetName, setSheetName] = useState('Stronger')

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
			await connectToSheet(spreadsheetId)
			saveSheetId(spreadsheetId)

			// Read config zone — if empty, signal setup needed
			const configs = await readConfigZone(spreadsheetId)
			if (!configs) {
				// Ensure tabs exist before handing off to setup
				const defsTabExists = await verifyWorkoutDefsTab(spreadsheetId)
				if (!defsTabExists) {
					await createWorkoutDefsTab(spreadsheetId)
				}
				const logTabExists = await verifyLogTab(spreadsheetId)
				if (!logTabExists) {
					await createLogTab(spreadsheetId)
				}
				// Ensure cardio tab exists
				const cardioTabExists = await verifyCardioTab(spreadsheetId)
				if (!cardioTabExists) {
					await createCardioTab(spreadsheetId)
				}

				setPhase('connected')
				if (onNeedsSetup) {
					onNeedsSetup(spreadsheetId)
				}
				return
			}

			// Read workout defs — if tab missing or empty, create + write defaults
			const defsTabExists = await verifyWorkoutDefsTab(spreadsheetId)
			if (!defsTabExists) {
				await createWorkoutDefsTab(spreadsheetId)
			}

			// Ensure log tab exists
			const logTabExists = await verifyLogTab(spreadsheetId)
			if (!logTabExists) {
				await createLogTab(spreadsheetId)
			}

			// Ensure cardio tab exists
			const cardioTabExists = await verifyCardioTab(spreadsheetId)
			if (!cardioTabExists) {
				await createCardioTab(spreadsheetId)
			}

			// Build a lift-name lookup for exercise display names
			const liftNames = new Map(configs.map((c) => [c.id, c.name]))

			let defs = await readWorkoutDefs(spreadsheetId, liftNames)
			if (!defs) {
				await writeDefaultWorkoutDefs(spreadsheetId, workoutDefinitions)
				defs = workoutDefinitions
			}

			// Read cardio activities — if empty, seed with defaults
			let cardio = await readCardioActivities(spreadsheetId)
			if (!cardio) {
				await writeDefaultCardioActivities(spreadsheetId, defaultCardioActivities)
				cardio = defaultCardioActivities
			}

			const workouts = buildWorkoutsFromConfigs(configs, defs)
			setPhase('connected')
			onConnected(workouts, configs, spreadsheetId, defs, cardio)
		} catch (err) {
			setError(
				err instanceof Error ? err.message : 'Unable to access the sheet.',
			)
			setPhase('error')
		}
	}, [onConnected, onNeedsSetup])

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

	const handleCreateSheet = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault()
			const name = sheetName.trim()
			if (!name) {
				setError('Please enter a name for the sheet.')
				return
			}
			try {
				setError(null)
				setPhase('connecting')
				const spreadsheetId = await createSpreadsheet(name)
				await tryConnect(spreadsheetId)
			} catch (err) {
				setError(
					err instanceof Error ? err.message : 'Failed to create the sheet.',
				)
				setPhase('error')
			}
		},
		[sheetName, tryConnect],
	)

	const handleSignOut = useCallback(async () => {
		await signOut()
		setSheetUrl('')
		setError(null)
		setPhase('sign-in')
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
				{error && <p className="auth-error">{error}</p>}

				<div className="sheet-option">
					<p className="sheet-option-label">Create new sheet</p>
					<form className="sheet-form" onSubmit={handleCreateSheet}>
						<input
							className="sheet-url-input"
							type="text"
							placeholder="Sheet name"
							value={sheetName}
							onChange={(e) => setSheetName(e.target.value)}
							autoFocus
						/>
						<button className="btn-primary" type="submit">
							Create &amp; connect
						</button>
					</form>
				</div>

				<div className="sheet-divider">
					<span>or</span>
				</div>

				<div className="sheet-option">
					<p className="sheet-option-label">Connect to existing sheet</p>
					<form className="sheet-form" onSubmit={handleSheetSubmit}>
						<input
							className="sheet-url-input"
							type="url"
							placeholder="https://docs.google.com/spreadsheets/d/…"
							value={sheetUrl}
							onChange={(e) => setSheetUrl(e.target.value)}
						/>
						<button className="btn-primary" type="submit">
							Connect
						</button>
					</form>
				</div>

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
			<div className="toolbar-nav">
				{onGoToList && (
					<button className="btn-toolbar" onClick={onGoToList} title="Workouts">
						<Dumbbell size={20} />
					</button>
				)}
				{onOpenCalendar && (
					<button className="btn-toolbar" onClick={onOpenCalendar} title="Schedule">
						<Calendar size={20} />
					</button>
				)}
				{onOpenExercises && (
					<button className="btn-toolbar" onClick={onOpenExercises} title="Exercises">
						<Library size={20} />
					</button>
				)}
				{onOpenProgress && (
					<button className="btn-toolbar" onClick={onOpenProgress} title="Progress">
						<TrendingUp size={20} />
					</button>
				)}
				{onOpenGarmin && (
					<button className="btn-toolbar" onClick={onOpenGarmin} title="Activities">
						<Activity size={20} />
					</button>
				)}
				{onOpenSettings && (
					<button className="btn-toolbar" onClick={onOpenSettings} title="Settings">
						<Settings size={20} />
					</button>
				)}
			</div>
			<button className="btn-toolbar" onClick={handleSignOut} title="Sign out">
				<LogOut size={20} />
			</button>
		</div>
	)
}
