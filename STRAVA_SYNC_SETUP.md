# Strava Sync Setup

Stronger can sync activity data into Google Sheets via the Strava API. Garmin watches auto-sync to Strava, and a scheduled GitHub Actions workflow pulls that data into a "Stronger - Strava" tab in your spreadsheet.

The workflow runs daily at 06:00 UTC and can also be triggered manually. It's idempotent — re-runs won't create duplicate rows.

## How it works

1. Your Garmin watch syncs activities to Strava (usually within 5–10 minutes).
2. A GitHub Actions workflow runs `scripts/strava-sync.mjs` on a daily schedule.
3. The script refreshes a Strava OAuth2 token, fetches the 30 most recent activities, deduplicates by Strava activity ID, and appends new rows to the sheet via a Google service account.

### Why Strava instead of Garmin directly?

Garmin has no public API for individual developers. Strava's API is official, stable, and well-documented. Since Garmin → Strava auto-sync is a standard feature, the data arrives in Strava within minutes.

## Data stored

Each activity row in the "Stronger - Strava" tab contains:

| Column | Description |
|--------|-------------|
| `date` | Activity date (YYYY-MM-DD) |
| `stravaId` | Strava activity ID (used for deduplication) |
| `activityType` | Strava activity type (e.g. Run, Ride, WeightTraining) |
| `name` | Activity name as set in Strava |
| `duration` | Duration in seconds |
| `distance` | Distance in meters (0 for stationary activities) |
| `elevationGain` | Total elevation gain in meters |
| `calories` | Calories burned |
| `avgHR` | Average heart rate in bpm (0 if not recorded) |
| `maxHR` | Max heart rate in bpm (0 if not recorded) |

## Prerequisites

- A Strava account with Garmin auto-sync enabled
- A Google Cloud service account with editor access to your spreadsheet
- A GitHub repository (this one) with Actions enabled

## Step 1: Create a Strava API application

1. Go to [strava.com/settings/api](https://www.strava.com/settings/api).
2. Create a new API application:
   - **Application Name**: anything (e.g. "Stronger Sync")
   - **Category**: choose any
   - **Website**: your GitHub Pages URL or `http://localhost`
   - **Authorization Callback Domain**: `localhost`
3. Note your **Client ID** and **Client Secret**.

## Step 2: Get a Strava refresh token

You need a one-time OAuth2 authorization to get a refresh token. Strava refresh tokens don't expire.

1. Open this URL in your browser, replacing `YOUR_CLIENT_ID`:

   ```
   https://www.strava.com/oauth/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http://localhost&scope=read,activity:read&approval_prompt=force
   ```

2. Authorize the app. You'll be redirected to `http://localhost/?code=AUTHORIZATION_CODE&...` — copy the `code` value from the URL.

3. Exchange the code for a refresh token:

   ```bash
   curl -X POST https://www.strava.com/oauth/token \
     -d client_id=YOUR_CLIENT_ID \
     -d client_secret=YOUR_CLIENT_SECRET \
     -d code=AUTHORIZATION_CODE \
     -d grant_type=authorization_code
   ```

4. The response JSON contains `refresh_token` — save this value.

## Step 3: Create a Google service account

The sync script uses a service account (not your personal OAuth) to write to the spreadsheet.

1. In the [Google Cloud Console](https://console.cloud.google.com/), go to **IAM & Admin → Service Accounts**.
2. Click **Create Service Account**.
3. Name it something like `stronger-sync` and click **Create and Continue**.
4. Skip the optional role and user access steps — click **Done**.
5. Click on the new service account, go to the **Keys** tab.
6. Click **Add Key → Create New Key → JSON**. Download the key file.
7. Copy the entire JSON content — you'll paste it into a repo secret.

## Step 4: Share your spreadsheet with the service account

1. Open the JSON key file and find the `client_email` field (e.g. `stronger-sync@your-project.iam.gserviceaccount.com`).
2. Open your Stronger spreadsheet in Google Sheets.
3. Click **Share** and add the service account email as an **Editor**.

## Step 5: Configure repository secrets

Go to your GitHub repo → **Settings → Secrets and variables → Actions** and add these 5 secrets:

| Secret | Value |
|--------|-------|
| `STRAVA_CLIENT_ID` | Your Strava API client ID |
| `STRAVA_CLIENT_SECRET` | Your Strava API client secret |
| `STRAVA_REFRESH_TOKEN` | The refresh token from Step 2 |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | The full JSON content of the service account key file |
| `SPREADSHEET_ID` | The ID from your spreadsheet URL (`https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`) |

## Step 6: Test the workflow

1. Go to **Actions → Strava Sync (Strava → Google Sheets)**.
2. Click **Run workflow** → **Run workflow** (on the main branch).
3. Check that the workflow completes successfully.
4. Open your spreadsheet — you should see a new "Stronger - Strava" tab with your recent activities.

After verifying, the daily cron at 06:00 UTC will keep it updated automatically.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Workflow fails with "Missing Strava environment variables" | One or more of the 3 Strava secrets are not configured. Check Settings → Secrets. |
| Workflow fails with "Missing GOOGLE_SERVICE_ACCOUNT_KEY" | The service account key secret is not set or is malformed. Paste the entire JSON content. |
| Workflow fails with "Missing SPREADSHEET_ID" | The spreadsheet ID secret is not set. |
| Strava token refresh fails (401) | The refresh token may be invalid. Re-do Step 2 to get a new one. |
| Sheets API returns 403 | The service account doesn't have editor access to the spreadsheet. Re-do Step 4. |
| "No new activities to sync" | All recent activities are already in the sheet. This is normal on re-runs. |
| Activities missing from Strava | Check that Garmin → Strava auto-sync is enabled in the Garmin Connect app (Settings → Connected Apps). |
