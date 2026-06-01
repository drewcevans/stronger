/**
 * Apps Script API client.
 * Replaces gapi with simple fetch calls to the Apps Script webhook.
 */

import { API_URL } from './config.ts'

/** Fetch all rows from a sheet tab as an array of objects. */
export async function readSheet<T = Record<string, string>>(
  sheetName: string
): Promise<T[]> {
  const url = `${API_URL}?sheet=${encodeURIComponent(sheetName)}`
  const response = await fetch(url)
  const json = await response.json()
  if (json.error) throw new Error(json.error)
  return json.data as T[]
}

/** Append a new row to a sheet tab. */
export async function appendRow(
  sheetName: string,
  row: Record<string, unknown>
): Promise<void> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheet: sheetName, row }),
  })
  const json = await response.json()
  if (json.error) throw new Error(json.error)
}

/** Update an existing row by index. */
export async function updateRow(
  sheetName: string,
  rowIndex: number,
  values: unknown[]
): Promise<void> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheet: sheetName, action: 'update', rowIndex, values }),
  })
  const json = await response.json()
  if (json.error) throw new Error(json.error)
}