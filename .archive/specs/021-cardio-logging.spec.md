# Feature: Cardio workout logging

> Allow cardio workouts to be executed and logged through the same tap-and-go flow as strength workouts.

## What

Right now, tapping a cardio workout on the home screen does nothing — there is no execution page for cardio. This spec adds a simple logging UI for cardio workouts.

When a user taps a cardio workout, they land on a single-exercise logging page. Unlike strength workouts (which have multiple exercises, each with sets), a cardio workout *is* the exercise — there is no separate exercise/set distinction. The page presents four optional numeric fields: duration (minutes), distance (miles), elevation (feet), and weight (pounds). The user fills in whichever fields are relevant, taps a finish button, and the entry is logged to the sheet.

The log entry should use the same log tab and row format as strength entries, adapting the existing columns where possible (e.g., using the weight column for body weight carried, or repurposing comment/notes for distance and elevation). Cardio entries should be distinguishable from strength entries when reading the log.

## Acceptance Criteria

- [ ] Tapping a cardio workout on the home screen opens a cardio logging page
- [ ] The page shows the workout name and four optional numeric inputs: duration, distance, elevation, weight
- [ ] All four fields default to empty (not zero) — the user only fills in what's relevant
- [ ] A finish button logs the entry to the sheet's log tab
- [ ] The log entry is identifiable as cardio when reading raw sheet data
- [ ] After logging, the user returns to the home screen (or sees a brief confirmation)
- [ ] The cardio page follows the existing neon visual style

## Scope

### In scope
- Cardio execution/logging page with the four fields
- Writing cardio log entries to the existing log tab
- Navigation from home screen to cardio page and back

### Out of scope
- Cardio-specific progression review or weight recommendations
- Displaying previous cardio session data inline
- Editing or deleting logged cardio entries
- Timer or stopwatch functionality
- Per-cardio-type field customization (all cardio workouts get the same four fields)

## Notes

- The log tab schema may need a minor extension or convention to distinguish cardio from strength entries (e.g., a category column, or using the set type column with a "cardio" value).
- Duration is in minutes, distance in miles, elevation in feet, weight in pounds — matching the user's existing conventions. No unit conversion needed.
- The cardio page is intentionally simpler than the strength workout page: no sets, no checkboxes, no rep steppers. Just fill in and go.
