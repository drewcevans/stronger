# Agent Notes — Stronger

Operational reminders for AI agents working on this project. Read this before starting any task.

## Project overview

Stronger is a barbell training tracker built as a single-page React app. It uses Google Sheets as its database — there is no backend. The app authenticates via Google OAuth, reads/writes lift configs, workout definitions, log entries, and schedule data directly to named tabs in the user's spreadsheet. It is deployed to GitHub Pages.

## Tech stack

- **React 19** + **TypeScript 5.7**, bundled with **Vite 6**
- **Vitest 4** for unit tests (`npm test`)
- **lucide-react** for icons
- No component library, no CSS framework — all styles in `src/App.css` using CSS custom properties
- Hosted on **GitHub Pages** at `/stronger/` (see `vite.config.ts` `base`)
- Google Sheets API via `gapi.client.sheets` loaded at runtime (no npm package)

## Development workflow

- **Spec-driven development.** Every feature starts with a spec in `specs/`. Completed specs live in `.archive/specs/`. Always read the relevant spec before implementing.
- **Push to main.** The user does not use PRs for most work — commit and push directly.
- **Tests matter.** Run `npx vitest run` before pushing. The 4 storage tests fail due to missing `document` in the test environment — that is pre-existing and expected.
- **Update specs after iteration.** If you make decisions beyond what the spec says, append a summary to the spec (even if archived).

## Architecture

### Data model (`src/model/types.ts`)

Seven-layer model, each building on the previous:

1. **LiftConfig** — per-lift settings (weights, increments, gear, category). 10 fields. Stored in the "Exercises" sheet tab.
2. **SetTemplate / ExerciseTemplate** — the structure of a workout (set types, percentages, rep ranges, roles). Stored in the "Workouts" sheet tab.
3. **ComputedSet / ComputedExercise** — concrete workout instances with calculated weights. Computed at runtime, never stored.
4. **Workout** — a named collection of computed exercises with `category` (`'strength' | 'cardio'`) and `favorite` flag.
5. **SetResult** — execution-time tracking of what the user actually did. Logged to the "Log" sheet tab.
6. **ScheduleEntry** — date→workoutId mapping. Stored in the "Schedule" sheet tab.
7. **ProgressionProposal** — post-workout weight-change suggestions. Ephemeral, never stored.

### Google Sheets tabs and ranges (`src/google/sheets.ts`, `src/google/config.ts`)

The app uses four tabs in the user's spreadsheet. Each tab has a header constant, a range constant, and serialization/deserialization functions.

| Tab name                | Range constant        | Header columns | Column span |
|-------------------------|-----------------------|----------------|-------------|
| `Stronger - Exercises`  | `CONFIG_RANGE = A:J`  | 10 (`id` → `category`) | A–J |
| `Stronger - Workouts`   | `WORKOUT_DEFS_RANGE = A:N` | 14 (`workoutId` → `favorite`) | A–N |
| `Stronger - Log`        | `LOG_READ_RANGE = A2:R`, `LOG_HEADER_RANGE = A1:R1`, `LOG_APPEND_RANGE = A2:R2` | 18 (`date` → `cardioWeight`) | A–R |
| `Stronger - Schedule`   | `SCHEDULE_READ_RANGE = A2:B10000`, `SCHEDULE_FULL_RANGE = A1:B10000` | 2 (`date`, `workoutId`) | A–B |

### Critical rule: keep ranges in sync with the data model

**When you add or remove a column from any header constant, you must update the corresponding range constants to match.** The letter in the range (e.g., `R` in `A2:R`) must cover all columns in the header array. If the header has 18 entries, the range must end at column R (the 18th column). If you add a 19th column, update every range for that tab to end at S.

The header arrays also serve as the human-readable column names in the actual spreadsheet. Use clear, descriptive field names — these are visible to the user when they open the sheet.

Use the formula: column letter = `String.fromCharCode(64 + columnCount)` (A=1, B=2, ... Z=26).

### Routing (`src/hooks/useHashRouter.ts`)

Hash-based SPA router. Routes:
- `#/` — workout list (home)
- `#/workout/<id>` — strength workout execution
- `#/cardio/<id>` — cardio workout logging
- `#/calendar` — calendar view
- `#/edit/<id>` or `#/edit/new` — workout editor
- `#/exercises` — exercise library
- `#/exercise/<id>` or `#/exercise/new` — exercise editor
- `#/progress` — progress charts

When adding a new view, add its route type to the `Route` union, update `parseHash`, and update `routeToHash`.

### Component structure (`src/components/`)

- `WorkoutSelect` — home screen, workout list with favorites
- `WorkoutView` — strength workout execution (sets, reps, checkboxes)
- `CardioView` — cardio logging (duration, distance, elevation, weight)
- `WorkoutEditor` — create/edit workout definitions
- `CalendarView` — schedule workouts to dates, history mode
- `CalendarPush` — push scheduled workouts to Google Calendar
- `ProgressView` — SVG line charts for progress metrics (volume, heaviest, e1RM)
- `ProgressionReview` — post-workout weight increase proposals
- `ExerciseLibrary` — browse and manage exercises
- `ExerciseEditor` — create/edit individual exercise configs
- `GoogleAuth` — OAuth sign-in, sheet connection, nav bar
- `SetupPage` — first-time setup wizard
- `MotivationalQuote` — random quotes display
- `Banner` / `Logo` / `LiftBadge` — branding and visual elements

### App orchestration (`src/App.tsx`)

`App.tsx` is the top-level component. It owns all state (workouts, configs, definitions, schedule, active workout) and passes callbacks down. Logging helpers (`logWorkoutResults`, `logCardioResult`) live at the bottom of this file as standalone async functions.

### Styling (`src/App.css`)

Neon design language using CSS custom properties:
- `--color-primary: #00e5ff` (neon cyan)
- `--color-accent: #ff2d7b` (neon pink)
- `--color-bg: #000` (black background)
- `--color-surface: #0a0a0a` (card backgrounds)
- Role-based set colors: `--color-warmup`, `--color-work`, `--color-backoff`, `--color-joker`

### Workout data (`src/data/sample-workouts.ts`, `lib/`)

Default lift configs and workout definitions are loaded from JSON files in `lib/` and used as seed data when a user connects a fresh spreadsheet. After first connect, the sheet is the source of truth.

## Common pitfalls

- **Sheet API 400 errors** usually mean a range doesn't cover enough columns for the data being written. Check that the range letter matches the header length.
- **Open-ended ranges** (e.g., `A:I`) are preferred for reading — they don't silently truncate if more rows exist than expected. The schedule tab is an exception and uses a row limit.
- **Cardio vs. strength** — these share the same log tab but have different columns populated. The `category` column distinguishes them. Cardio rows have zeros in the strength-specific columns and values in the cardio-specific ones.
- **Old log rows** — rows written before the cardio extension have no `category` column. `parseLogRow` defaults missing category to `'strength'`.
