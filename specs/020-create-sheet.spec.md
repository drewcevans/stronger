# Feature: Create or connect sheet by name

> Let the user create a new Google Sheet by name (defaulting to "Stronger") or paste an existing sheet URL, replacing the URL-only connection flow.

## What

Today the sheet-input screen only accepts a Google Sheets URL. This works for reconnecting to an existing sheet, but new users must manually create a blank spreadsheet in Google Drive first, then paste the URL back into the app. That's friction.

This spec reworks the sheet connection screen to offer two paths side by side:

1. **Create new sheet** — the user types a name (pre-filled with "Stronger") and the app creates a new Google Spreadsheet via the Sheets API, then connects to it. All required tabs and headers are set up automatically (as they already are during `connectToSheet`).

2. **Connect to existing sheet** — the user pastes a Google Sheets URL, same as today.

Both paths lead to the same `tryConnect` flow once a spreadsheet ID is in hand. The create path just adds a Sheets API `create` call beforehand.

## Acceptance Criteria

- [ ] The sheet-input screen shows two options: "Create new sheet" and "Connect to existing sheet."
- [ ] "Create new sheet" has a text input pre-filled with "Stronger" that the user can change.
- [ ] Submitting "Create new sheet" creates a new Google Spreadsheet with the given name and connects to it.
- [ ] "Connect to existing sheet" accepts a Google Sheets URL and works as it does today.
- [ ] After creating a new sheet, its spreadsheet ID is saved so future visits auto-reconnect.
- [ ] Error states are handled for both paths (e.g., API failure, invalid URL).

## Scope

### In scope
- Reworked sheet-input UI with two connection methods
- Google Sheets API `create` call to make a new spreadsheet
- Default sheet name ("Stronger") with user-editable input

### Out of scope
- Choosing a Google Drive folder for the new sheet
- Renaming or deleting sheets from within the app
- Managing multiple sheets (switching between spreadsheets)

## Notes

- The Google Sheets API `spreadsheets.create` method works with the existing OAuth scope (`spreadsheets`). No new scope is needed.
- The existing `connectToSheet` flow already handles tab creation (config, log, workout defs). After `create` returns a spreadsheet ID, the same flow applies.
- The two-path UI should be simple — not tabs or a modal, just two clearly labeled sections on the same screen. Phone-first: big touch targets, minimal text.
