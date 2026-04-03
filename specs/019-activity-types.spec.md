# Feature: Activity types (strength and cardio)

> Add a category field to exercises so the app can distinguish strength workouts from cardio activities, enabling a broader activity list for calendar planning.

## What

Today every entry in the app is an implicitly strength-training workout with sets, reps, and weights. To support a comprehensive calendar (spec 016), the app needs to handle other kinds of activities — running, rucking, climbing, etc. — that don't go through the set/rep/weight tracking flow.

This spec introduces an activity-type category (e.g., "strength" vs. "cardio") stored in the Google Sheet alongside the existing workout/exercise definitions. Strength workouts continue to work exactly as they do today. Cardio activities are simpler entries — just a name and category — that can be assigned to calendar days but don't have computed sets or progression tracking.

The workout list and the calendar's workout picker both display activities grouped by category: strength workouts first, then cardio, separated by a visual divider. Within each group, items appear in the order they are defined in the sheet.

## Acceptance Criteria

- [ ] Each exercise/activity in the sheet has a category field (e.g., "strength" or "cardio").
- [ ] Existing strength workouts default to the "strength" category with no user action required.
- [ ] Cardio activities can be defined in the sheet with a name and category (no sets/reps/weights).
- [ ] The main workout list shows a visual distinction between strength and cardio entries.
- [ ] The calendar day picker (spec 016) groups items: strength first, then cardio, with a divider.
- [ ] Sort order within each group matches the order found in the sheet.
- [ ] Selecting a cardio activity on the calendar assigns it to that day (no workout-view navigation).

## Scope

### In scope
- Category field in the sheet data model
- Reading and displaying cardio activities alongside strength workouts
- Grouped, ordered display in the workout list and calendar picker
- Backward compatibility — sheets without a category column treat all entries as strength

### Out of scope
- Tracking or logging cardio activities (duration, distance, etc.) — future spec
- Additional categories beyond strength and cardio
- Editing activity definitions from the app (sheet is the authoring surface)

## Notes

- The sheet is the source of truth for activity definitions. Adding a cardio activity means adding a row to the sheet — the app reads it, it doesn't create it. This aligns with the manifesto's "Google Sheets is the database" principle.
- The category could be a column in an existing zone or a new tab. Keep it simple — a single column value like "strength" or "cardio" is sufficient.
- Tapping a cardio entry on the calendar shouldn't try to open a workout view (there are no sets). It just marks that day as having that activity. A detail/logging view for cardio can come later.
