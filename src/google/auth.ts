// Auth is handled by Apps Script — no OAuth required.
export function signIn(): Promise<void> { return Promise.resolve() }
export function signOut(): Promise<void> { return Promise.resolve() }
export function hasToken(): boolean { return true }
export function restoreToken(): boolean { return true }
export function clearAuth(): void {}
export async function withAuthRetry<T>(fn: () => Promise<T>): Promise<T> { return fn() }

// Kept for backward compatibility with components that still import these.
export function loadGis(): Promise<void> { return Promise.resolve() }
export function loadGapi(): Promise<void> { return Promise.resolve() }
export function initGapiClient(): Promise<void> { return Promise.resolve() }
export function isAuthError(_err: unknown): boolean { return false }
export function describeSheetError(_err: unknown): string { return '' }
