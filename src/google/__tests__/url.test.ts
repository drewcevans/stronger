import { describe, expect, it } from 'vitest'
import { extractSheetId } from '../url.ts'

describe('extractSheetId', () => {
	it('extracts the ID from a standard Google Sheets URL', () => {
		const url =
			'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit'
		expect(extractSheetId(url)).toBe(
			'1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
		)
	})

	it('extracts the ID when the URL has a gid parameter', () => {
		const url =
			'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit#gid=0'
		expect(extractSheetId(url)).toBe(
			'1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
		)
	})

	it('extracts the ID from a URL with query parameters', () => {
		const url =
			'https://docs.google.com/spreadsheets/d/abc123_-XYZ/edit?usp=sharing'
		expect(extractSheetId(url)).toBe('abc123_-XYZ')
	})

	it('handles URLs with trailing slash only', () => {
		const url =
			'https://docs.google.com/spreadsheets/d/abc123/'
		expect(extractSheetId(url)).toBe('abc123')
	})

	it('handles leading/trailing whitespace', () => {
		const url =
			'  https://docs.google.com/spreadsheets/d/abc123/edit  '
		expect(extractSheetId(url)).toBe('abc123')
	})

	it('returns null for a non-Google-Sheets URL', () => {
		expect(extractSheetId('https://example.com')).toBeNull()
	})

	it('returns null for an empty string', () => {
		expect(extractSheetId('')).toBeNull()
	})

	it('returns null for a Google Docs URL (not Sheets)', () => {
		expect(
			extractSheetId(
				'https://docs.google.com/document/d/abc123/edit',
			),
		).toBeNull()
	})

	it('returns null for a URL missing the spreadsheet ID segment', () => {
		expect(
			extractSheetId('https://docs.google.com/spreadsheets/'),
		).toBeNull()
	})
})
