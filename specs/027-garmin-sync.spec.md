# Feature: Garmin Connect Data Sync

> Automatically download activity and body data from Garmin Connect and store it in a new Google Sheet tab, so the app can display Garmin-tracked metrics alongside manually logged workouts.

## What

A scheduled GitHub Actions workflow pulls the user's latest data from Garmin Connect and writes it to a new "Stronger - Garmin" tab in the Google Sheet. This keeps Garmin data flowing into the same sheet-based data model without requiring any backend or manual export steps.

The workflow uses [garmindb](https://github.com/tcgoetz/GarminDB) (or its underlying `garth` SSO library) to authenticate with Garmin and download data. A script then extracts the relevant fields and appends new rows to the sheet via a Google service account. The workflow runs daily on a cron schedule and can also be triggered manually.

The app reads the Garmin tab at load time alongside the other tabs. This spec covers only the data pipeline — displaying the data in the UI is deferred.

## Acceptance Criteria

- [ ] A new GitHub Actions workflow (`garmin-sync.yml`) runs on a daily cron schedule and on `workflow_dispatch`
- [ ] The workflow authenticates with Garmin Connect using stored credentials (repo secrets)
- [ ] The workflow downloads activity data (date, activity type, duration, distance, calories, avg heart rate) and body composition data (weight, body fat %)
- [ ] New rows are appended to a "Stronger - Garmin" tab in the user's Google Sheet via a service account
- [ ] Duplicate rows (same date + activity) are not created on re-runs — the sync is idempotent
- [ ] The sheet tab has a clear header row with descriptive column names
- [ ] A `GARMIN_SYNC_RANGE` and header constant are added to `src/google/config.ts` for the new tab
- [ ] The app can read and deserialize rows from the Garmin tab (type definitions + parse function)

## Scope

### In scope
- GitHub Actions workflow for scheduled sync
- Garmin authentication via garmindb/garth + repo secrets
- Activity summary data (date, type, duration, distance, calories, avg HR)
- Body composition data (weight, body fat %)
- Writing to a new Google Sheet tab via service account
- TypeScript types and sheet config for reading the tab in the app

### Out of scope
- UI for displaying Garmin data (future spec)
- Granular data (per-second HR, GPS tracks, lap splits)
- Two-way sync (writing back to Garmin)
- Sleep data, stress data, daily steps (can be added later)
- Garmin Connect IQ or webhook-based approaches

## Notes

- **Service account**: The existing app uses user OAuth for sheet access. The GitHub Actions workflow will need a Google service account with editor access to the spreadsheet. The service account key goes in a repo secret. This is the same pattern used for any server-side Sheets integration.
- **Garmin credentials**: garmindb/garth uses Garmin SSO with username + password. These go in repo secrets (`GARMIN_EMAIL`, `GARMIN_PASSWORD`). garth supports token persistence — the workflow should cache the session token between runs to avoid repeated logins.
- **garmindb vs garth**: garmindb downloads everything into SQLite, which is more than we need. Using `garth` directly to hit Garmin's internal API endpoints for activity summaries and body composition may be simpler. Either approach works.
- **Idempotency**: The simplest approach is to always sync the last N days (e.g., 7) and upsert by date + activity ID. This handles late-arriving data and avoids needing to track a high-water mark.
- **Column layout**: Suggested columns — `date`, `activityId`, `activityType`, `name`, `duration`, `distance`, `calories`, `avgHR`, `weight`, `bodyFat`. Body composition rows would have the activity columns empty and vice versa. Alternatively, split into two tabs — but one tab is simpler to start.
