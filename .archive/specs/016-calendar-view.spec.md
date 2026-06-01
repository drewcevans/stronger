# Feature: In-app calendar view

> A scrollable day-by-day calendar within the app for planning which workouts happen on which days, stored in the Google Sheet.

## What

Today the app shows a flat list of available workouts with no concept of scheduling. This feature adds a calendar page that displays the upcoming weeks as a vertical, scrollable list of days. Each day can have zero or more workouts assigned to it.

The user taps a day to assign one or more strength-training workouts from the available workout list. Tapping an assigned workout opens it (via the deep-link router from spec 014). The schedule data is persisted in the Google Sheet — a dedicated tab or zone — so it survives page reloads and is visible as a human-readable record alongside the existing workout data.

This calendar view becomes the primary way to plan training. Spec 015 (Google Calendar push) can later read from this same schedule data to export events to an external calendar.

## Acceptance Criteria

- [ ] A new "Calendar" view shows upcoming days in a scrollable, day-by-day layout.
- [ ] Each day displays its date and any assigned workouts.
- [ ] The user can assign a workout to a day from the list of available workouts.
- [ ] The user can assign multiple workouts to the same day.
- [ ] The user can remove a workout from a day.
- [ ] Tapping an assigned workout navigates to that workout (deep link).
- [ ] Schedule data is persisted in the Google Sheet and survives page reloads.
- [ ] The calendar view is accessible via the app's navigation (router from spec 014).

## Scope

### In scope
- Day-by-day scrollable calendar UI (next few weeks)
- Assigning and removing strength-training workouts per day
- Persisting the schedule in the Google Sheet
- Navigation between calendar view and other views

### Out of scope
- Non-strength activity types (running, climbing, etc.) — covered by a future spec
- Pushing schedule to Google Calendar (spec 015, can be updated to read from this data)
- Drag-and-drop reordering or week-view layouts
- Historical calendar view (past days)

## Notes

- This spec depends on spec 014 (deep-link router) for navigation to workouts and for the calendar view's own route.
- The sheet storage format for the schedule should be simple — e.g., rows of `[date, workoutId]`. This keeps it readable and easy to extend later when non-strength activities are added.
- Spec 015 currently defines its own day→workout mapping UI. Once this spec is implemented, spec 015 should be updated to read from the persisted schedule rather than configuring a separate mapping. That's a follow-up concern, not a blocker.
- A future spec will add non-strength activity types (running, rocking, climbing, etc.) as calendar entries that are visible on this same view but not tracked in the workout log.
