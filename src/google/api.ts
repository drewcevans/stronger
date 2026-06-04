/**
 * Apps Script API client.
 * All requests use GET to avoid CORS preflight issues with Apps Script.
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
  const payload = encodeURIComponent(JSON.stringify({ sheet: sheetName, row }))
  const url = `${API_URL}?action=append&data=${payload}`
  const response = await fetch(url)
  const json = await response.json()
  if (json.error) throw new Error(json.error)
}

/** Overwrite all data rows in a sheet tab (header row is preserved). */
export async function writeSheet(
  sheetName: string,
  rows: Record<string, unknown>[]
): Promise<void> {
  const payload = encodeURIComponent(JSON.stringify({ sheet: sheetName, action: 'writeAll', rows }))
  const url = `${API_URL}?action=writeAll&data=${payload}`
  const response = await fetch(url)
  const json = await response.json()
  if (json.error) throw new Error(json.error)
}

/** Update an existing row by index. */
export async function updateRow(
  sheetName: string,
  rowIndex: number,
  values: unknown[]
): Promise<void> {
  const payload = encodeURIComponent(JSON.stringify({ sheet: sheetName, action: 'update', rowIndex, values }))
  const url = `${API_URL}?action=update&data=${payload}`
  const response = await fetch(url)
  const json = await response.json()
  if (json.error) throw new Error(json.error)
}
/** Delete rows matching a where clause. */
export async function deleteRows(
  sheetName: string,
  where: Record<string, unknown>
): Promise<void> {
  const payload = encodeURIComponent(JSON.stringify({ 
    sheet: sheetName, 
    where 
  }))
  const url = `${API_URL}?action=deleteRow&data=${payload}`
  const response = await fetch(url)
  const json = await response.json()
  if (json.error) throw new Error(json.error)
}

/**
 * Read all rows from a sheet, match client-side, then delete by exact row number.
 * More reliable than server-side matching when dates contain ISO timestamps.
 */
export async function findAndDeleteRows(
  sheetName: string,
  where: Record<string, string>
): Promise<void> {
  const rows = await readSheet<Record<string, string>>(sheetName)

  const matchingIndices: number[] = []
  rows.forEach((row, idx) => {
    const matches = Object.entries(where).every(([key, val]) => {
      const rowVal = String(row[key] ?? '').trim()
      const searchVal = String(val).trim()
      // For date-like values, compare only the YYYY-MM-DD portion
      if (/\d{4}-\d{2}-\d{2}/.test(rowVal)) {
        const rowDate = rowVal.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? rowVal
        const searchDate = searchVal.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? searchVal
        return rowDate === searchDate
      }
      return rowVal === searchVal
    })
    if (matches) matchingIndices.push(idx + 2) // +2: 1-index + header row
  })

  if (matchingIndices.length === 0) return

  const payload = encodeURIComponent(JSON.stringify({ sheet: sheetName, rowNumbers: matchingIndices }))
  const url = `${API_URL}?action=deleteByRowNumbers&data=${payload}`
  const response = await fetch(url)
  const json = await response.json()
  if (json.error) throw new Error(json.error)
}

/** Insert a new row or update existing row matching where clause. */
export async function upsertRow(
  sheetName: string,
  where: Record<string, unknown>,
  row: Record<string, unknown>
): Promise<void> {
  const payload = encodeURIComponent(JSON.stringify({ 
    sheet: sheetName, 
    where, 
    row 
  }))
  const url = `${API_URL}?action=upsertRow&data=${payload}`
  const response = await fetch(url)
  const json = await response.json()
  if (json.error) throw new Error(json.error)
}