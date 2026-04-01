import { useState, useEffect, useCallback, useRef } from 'react'
import {
	loadGis,
	loadGapi,
	initGapiClient,
	signIn,
	signOut,
	hasToken,
	extractSheetId,
	saveSheetId,
	loadSheetId,
	clearSheetId,
	connectToSheet,
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
	onConnected: () => void
}

export function GoogleAuth({ onConnected }: Props) {
	const [phase, setPhase] = useState<Phase>('loading')
	const [error, setError] = useState<string | null>(null)
	const [sheetUrl, setSheetUrl] = useState('')
	const [sheetTitle, setSheetTitle] = useState<string | null>(null)
	const notifiedRef = useRef(false)

	// Notify parent once when connected
	useEffect(() => {
		if (phase === 'connected' && !notifiedRef.current) {
			notifiedRef.current = true
			onConnected()
		}
	}, [phase, onConnected])

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
			setPhase('connected')
		} catch (err) {
			setError(
				err instanceof Error ? err.message : 'Unable to access the sheet.',
			)
			setPhase('error')
		}
	}, [])

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
				setError('That doesn\u2019t look like a Google Sheets URL.')
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
		notifiedRef.current = false
		setSheetTitle(null)
		setSheetUrl('')
		setError(null)
		setPhase('sign-in')
	}, [])

	const handleDisconnect = useCallback(() => {
		clearSheetId()
		notifiedRef.current = false
		setSheetTitle(null)
		setSheetUrl('')
		setError(null)
		setPhase('sheet-input')
	}, [])

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
