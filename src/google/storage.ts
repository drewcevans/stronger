// No token storage needed — Apps Script handles auth.
export function saveToken(): void {}
export function loadToken(): string | null { return 'apps-script' }
export function clearToken(): void {}
export function saveSheetId(id: string): void { localStorage.setItem('sheetId', id) }
export function loadSheetId(): string | null { return localStorage.getItem('sheetId') }
export function clearSheetId(): void { localStorage.removeItem('sheetId') }
export function saveCalendarId(_id?: string): void {}
export function loadCalendarId(): string | null { return null }
export function clearCalendarId(): void {}
