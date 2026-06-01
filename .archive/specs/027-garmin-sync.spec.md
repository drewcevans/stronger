# Feature: Garmin Data Sync via Strava

> Pull activity and fitness data from Garmin (via the Strava API) into a new Google Sheet tab, so the app can display Garmin-tracked metrics alongside manually logged workouts.

## What

Garmin auto-syncs activities to Strava, and Strava has a proper OAuth2 REST API. A scheduled GitHub Actions workflow uses the Strava API to fetch recent activities, then writes them to a new "Stronger - Garmin" tab in the Google Sheet. This keeps Garmin data flowing into the sheet-based data model without a backend, manual exports, or reverse-engineered auth.

The workflow authenticates with Strava using a refresh token stored in repo secrets. A Node.js script refreshes the access token, fetches activity summaries from the Strava API, and appends new rows to the sheet via a Google service account. The workflow runs daily on a cron schedule and can also be triggered manually.

The app reads the Garmin tab at load time alongside the other tabs. This spec covers only the data pipeline — displaying the data in the UI is deferred.

### Why Strava instead of Garmin directly?

Garmin has no public API for individual developers. The unofficial SSO approach used by garth/garmindb was [deprecated in March 2026](https://github.com/matin/garth/discussions/222) after Garmin added Cloudflare TLS fingerprinting that blocks third-party clients. Strava's API is official, stable, and well-documented. Since Garmin → Strava auto-sync is a standard feature, the data arrives in Strava within minutes of a Garmin activity.

## Acceptance Criteria

- [ ] A new GitHub Actions workflow (`garmin-sync.yml`) runs on a daily cron schedule and on `workflow_dispatch`
- [ ] The workflow authenticates with Strava using an OAuth2 refresh token (repo secret)
- [ ] The workflow fetches recent activities from the Strava API (date, activity type, duration, distance, calories, avg heart rate, elevation gain)
- [ ] New rows are appended to a "Stronger - Garmin" tab in the user's Google Sheet via a service account
- [ ] Duplicate rows (same Strava activity ID) are not created on re-runs — the sync is idempotent
- [ ] The sheet tab has a clear header row with descriptive column names
- [ ] A `GARMIN_SYNC_RANGE` and header constant are added to `src/google/config.ts` for the new tab
- [ ] The app can read and deserialize rows from the Garmin tab (type definitions + parse function)

## Scope

### In scope
- GitHub Actions workflow for scheduled sync
- Strava OAuth2 token refresh via repo secrets
- Activity summary data from Strava (date, type, name, duration, distance, calories, avg HR, elevation gain)
- Writing to a new Google Sheet tab via service account
- TypeScript types and sheet config for reading the tab in the app
- One-time Strava OAuth2 setup instructions (get initial refresh token)

### Out of scope
- UI for displaying Garmin/Strava data (future spec)
- Granular data (per-second HR, GPS tracks, lap splits, streams)
- Two-way sync (writing back to Strava or Garmin)
- Body composition data (weight, body fat — not available via Strava)
- Sleep data, stress data, daily steps
- Direct Garmin Connect integration (blocked by Garmin)

## Notes

- **Strava OAuth2 setup**: One-time manual step. Create a Strava API app at [strava.com/settings/api](https://www.strava.com/settings/api), authorize with the `read,activity:read` scopes, capture the refresh token. Store `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, and `STRAVA_REFRESH_TOKEN` as repo secrets. The workflow refreshes the access token on each run — refresh tokens don't expire.
- **Service account**: Same as before — a Google service account with editor access to the spreadsheet. Service account key JSON goes in a repo secret (`GOOGLE_SERVICE_ACCOUNT_KEY`).
- **Strava API rate limits**: 100 requests per 15 minutes, 1000 per day. Fetching the last 30 activities per run is well within limits.
- **Idempotency**: Read existing rows from the sheet, check Strava activity IDs, only append new ones. Simple and reliable.
- **Column layout**: Suggested columns — `date`, `stravaId`, `activityType`, `name`, `duration`, `distance`, `elevationGain`, `calories`, `avgHR`, `maxHR`. All from Strava's `SummaryActivity` response.
- **Tab naming**: The tab is called "Stronger - Garmin" because the data originates from the Garmin watch, even though Strava is the intermediary. Could also be called "Stronger - Activities" — open to either.
- **Garmin → Strava delay**: Activities typically appear in Strava within 5-10 minutes of syncing from the watch. The daily cron schedule means data is never more than ~24h behind.
