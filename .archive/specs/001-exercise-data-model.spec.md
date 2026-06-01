# Feature: Exercise data model

> Define a structured data model for exercises, sets, and per-lift configuration so that workouts can be calculated, stored, and progressed week-to-week in a Google Sheet.

## What

We need a data model that captures all the parameters required to fully describe a workout program like RSS Intermediate B. The model must support percentage-based weight calculations, independent tracking of top-set and backoff weights, rep ranges, AMRAP sets, per-set comments (e.g., progression rules), and per-lift configuration such as weight floors and rounding.

**The Google Sheet is the source of truth.** Every parameter in this model — top set weight, backoff weight, increment, minimum, rounding factor — must be a cell in the spreadsheet that the user can edit at any time. The app reads these values on load and calculates the workout from them. There is no configuration in application code. If a user has a bad week and wants to increase bench by 1 lb instead of 2.5 lbs, they edit the cell in the sheet, and the next time they load the app the workout reflects the change.

**The sheet has two zones:**

1. **Inputs** (top of the sheet) — editable cells for each lift's configuration: top set weight, backoff weight, increment, minimum weight, rounding factor, and any other parameters. These are the only cells the user ever edits. In the future, the app will provide UI to edit these directly; for now, they are edited in the spreadsheet.
2. **Computed workouts** (below the inputs) — the weekly workout plan with concrete weights for every set. These are entirely derived from the inputs via percentage calculations, rounding, and minimum clamping. The user never manually edits these cells.

The model has three layers:

1. **Lift configuration** — per-lift settings that control how weights are calculated and progressed (e.g., top set weight, backoff weight, increment, minimum weight, rounding factor).
2. **Exercise template** — the ordered list of sets for a given exercise in a workout, with each set's type, percentage basis, rep scheme, and comments.
3. **Weekly instance** — a concrete workout for a specific week with calculated weights, to be written into the spreadsheet.

## Acceptance Criteria

- [ ] Each set has a **set type**: warmup, work, or backoff.
- [ ] Each set has a **percentage** of a reference weight (top set weight or backoff weight, depending on the set). The "top set" is the work set at 100% — it is not a separate type, but is identifiable as the work set with the highest percentage.
- [ ] Each set has **min reps** and **max reps**. Fixed-rep sets use the same value for both (e.g., min=5, max=5). Ranged sets differ (e.g., min=3, max=5).
- [ ] Each set has an **AMRAP flag** indicating whether the lifter should do as many reps as possible beyond the minimum.
- [ ] Each set has an optional **comment** field for progression rules or other notes visible in the app (e.g., "If 5 reps completed, increase by 2.5 lbs next week").
- [ ] Each lift has a **top set weight** and a **backoff weight**, tracked independently and updatable week-to-week.
- [ ] Each lift has an **increment** — the amount of weight to add on successful progression (e.g., 2.5 lbs for bench, 5 lbs for squat).
- [ ] Each lift has a **minimum weight** — a floor below which no set will be programmed, regardless of percentage (e.g., squat warmup cannot go below 95 lbs even if 45% calculates to 65 lbs).
- [ ] Each lift has a **rounding factor** — all calculated weights are rounded to the nearest multiple (e.g., 5 lbs for barbell, 2.5 lbs for smaller increments).
- [ ] The model supports sets where the percentage basis is derived from a *different* lift's top set weight (e.g., secondary press at 85% of primary press top set).
- [ ] Given a lift configuration and an exercise template, all set weights for a given week can be deterministically calculated.
- [ ] All lift configuration values (top set weight, backoff weight, increment, minimum, rounding factor) are stored as editable cells in the Google Sheet — not in application code. The user can change any value at any time, and the app recalculates on next load.

## Scope

### In scope
- Defining the data model (fields, types, relationships)
- Defining the two-zone sheet layout: inputs at the top, computed workouts below
- Documenting how calculations work (percentage × reference weight → round → clamp to minimum)
- Identifying what goes into the Google Sheet and how it maps to columns/rows

### Out of scope
- Implementing the Google Sheets read/write code
- Building the UI
- In-app editing of lift configuration inputs (future spec)
- Progression logic that automatically updates weights week-to-week (separate spec)
- Defining specific workout programs (already captured in `workouts/` folder)

## Notes

- The workout file `workouts/rss-intermediate-b.md` serves as the primary test case for validating this model. Every set in that file should be expressible with this data model.
- Secondary lifts derive their working weight from another lift's primary top set (e.g., secondary press = 85% of primary press top set; secondary squat = 75% of primary squat top set). The model needs a way to express this cross-reference.
- Assistance exercises use their own independent working weight, not derived from a primary lift. They still need top set / backoff tracking (e.g., skull crusher 100% × 8, 85% × 8+).
- All primary and secondary lifts (barbell lifts) always begin with a warmup set of the empty bar (45 lbs × 10 reps). This is a fixed warmup, not percentage-based. Assistance exercises do not have this bar warmup.
