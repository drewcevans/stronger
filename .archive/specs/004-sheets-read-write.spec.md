# Feature: Google Sheets read/write integration

> Connect the app to its Google Sheet database — write default lift configs on first connect, read them back on subsequent visits to compute workouts, and log every completed set as an append-only history.

## What

The app has Google Sheets connectivity, a data model, and a workout UI, but they aren't wired together. This spec closes that loop by defining exactly how data flows between the app and the "Stronger" tab.

The sheet has two zones, separated by a blank row:

1. **Config zone** (rows 1–8) — A header row followed by one row per lift. This is where LiftConfig values live: the weights, increments, and rounding factors that drive workout computation. On first connection (tab is empty), the app writes the default values from the hardcoded sample data. On every subsequent visit, the app reads these cells and uses them to build workouts. The user can edit these cells directly in the sheet at any time.

2. **Log zone** (row 10 onward) — A header row followed by an append-only list of set-level entries. Every time a workout is finished, one row per set is appended with timestamps, planned values, and actual results. This is the human-readable audit trail. The log grows downward forever; nothing is ever deleted or overwritten.

The config zone column layout (A–G):

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| id | name | topSetWeight | backoffWeight | increment | minimumWeight | roundingFactor |

Row 1 is the header. Rows 2–7 are the six lifts (one per row).

Row 9 is blank (separator).

The log zone column layout (row 10 header, row 11+ data):

| A | B | C | D | E | F | G | H | I | J | K | L | M |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| date | startTime | endTime | workoutId | exerciseName | liftId | setNumber | setType | plannedWeight | plannedReps | actualWeight | actualReps | completed |

- **date** — `YYYY-MM-DD` for the day the workout was finished.
- **startTime** — ISO 8601 timestamp recorded when the user selects a workout.
- **endTime** — ISO 8601 timestamp recorded when the user presses "Finish Workout".
- **workoutId** — the workout identifier (e.g., `A`, `B`, `C`, `D`).
- **setNumber** — 1-based index of the set within its exercise.
- **plannedReps** — the `maxReps` value from the computed set (target reps).
- **completed** — `TRUE` or `FALSE`.

Multiple workouts on the same day are distinguishable by their unique `startTime`/`endTime` pair.

Exercise templates (the set structures, percentages, and rep ranges that define the program) remain in application code. Only the LiftConfig values come from the sheet. The app reads configs → computes exercises via the existing `computeExercise` function → presents workouts.

The gapi types must be extended to support the Sheets Values API (`spreadsheets.values.get`, `spreadsheets.values.update`, `spreadsheets.values.append`), which is needed for reading/writing cell ranges.

## Acceptance Criteria

- [ ] On first connection to an empty "Stronger" tab, the app writes the config header row and one row per lift with default LiftConfig values.
- [ ] On subsequent visits, the app reads the config zone and uses those values (not hardcoded defaults) to compute workouts.
- [ ] If the user edits a LiftConfig value in the sheet (e.g., changes bench topSetWeight from 200 to 205), the app reflects the change on next load.
- [ ] The workout selection screen shows workouts computed from sheet-sourced LiftConfig data, not hardcoded sample data.
- [ ] A `startTime` is recorded when the user selects a workout.
- [ ] An `endTime` is recorded when the user presses "Finish Workout".
- [ ] On workout finish, one row per set is appended to the log zone with all 13 columns populated.
- [ ] Log rows are appended below all existing rows — previous log entries are never modified.
- [ ] Two workouts finished on the same day have different `startTime`/`endTime` values, making them distinguishable.
- [ ] The gapi type declarations are extended to cover the Sheets Values API surface used (`values.get`, `values.update`, `values.append`).
- [ ] The config zone (rows 1–8) and log zone (row 10+) are separated by a blank row and do not interfere with each other.

## Scope

### In scope
- Defining the config zone layout (columns, header, one row per lift)
- Defining the log zone layout (columns, header, append-only rows)
- Writing default config on first connection
- Reading config on subsequent visits to compute workouts
- Appending set-level log rows on workout finish
- Recording start/end timestamps for each workout
- Extending gapi types for the Values API
- Replacing hardcoded `sampleWorkouts` usage with sheet-driven data

### Out of scope
- In-app UI for editing LiftConfig values (user edits the sheet directly for now)
- Automatic weight progression after a successful workout (future spec)
- Reading the log zone back into the app (log is write-only for now)
- Displaying workout history in the UI
- Offline support or caching

## Notes

- The six lifts and their default values come from the existing `sample-workouts.ts` config. The exercise *templates* (set structures) also stay in code — they define the program structure. Only the numeric config values are sheet-sourced.
- The config zone is a fixed size (header + 6 lift rows). If a new lift is added to the program in the future, rows would need to be added — but that's a future concern. For now, the set of lifts is static.
- The Values API uses A1 range notation (e.g., `Stronger!A1:G8` for the config zone). This is simpler than the batchUpdate API already in use and well-suited for reading/writing rectangular ranges.
- The blank separator row (row 9) prevents the config and log zones from being treated as one contiguous table by Sheets' auto-detection features.
- `plannedReps` uses `maxReps` from the computed set because that represents the target the lifter is aiming for. The rep range (min/max) is visible in the app UI during the workout but doesn't need to be logged — the actual reps tell the real story.
