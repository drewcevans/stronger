# Feature: Post-workout weight progression

> After finishing a workout, show proposed weight updates for each lift and write the confirmed values back to the spreadsheet.

## What

When the user taps "Finish" on a workout, instead of immediately returning to the workout list, the app navigates to a progression review page. This page evaluates every exercise in the completed workout and proposes weight changes based on the rep-range criteria already defined in the program: if the top end of the rep range was achieved (or exceeded), the lift's weight increases by its configured increment; otherwise the weight stays the same.

Each proposed change is shown as a line item the user can review and override (e.g. accept the suggested increase, keep the current weight, or type a custom value). Once the user confirms, the app writes the updated `topSetWeight` and/or `backoffWeight` values back to the config zone of the Google Sheet. The next time a workout is loaded, it picks up the new weights automatically.

This covers primary and assistance lifts only. Secondary lifts are always derived from their primary lift's config (via cross-reference percentages) and are not independently editable — when a primary lift's weight is updated, the secondary lift's weight follows automatically on the next load.

## Acceptance Criteria

- [ ] Tapping "Finish" navigates to a progression review page (not directly back to the workout list).
- [ ] For each primary and assistance exercise, the page reads the lift's `increment` from the sheet config and the rep-range upper bound from the set template.
- [ ] Secondary lifts (exercises using `crossReference` weight basis) are excluded from the progression page — their weights are always derived from the primary.
- [ ] If the recorded reps on the relevant set meet or exceed the upper bound, the proposed new weight = current weight + increment.
- [ ] If the recorded reps are below the upper bound, the proposed new weight = current weight (no change).
- [ ] Each proposed weight is editable — the user can accept, reject, or override with a custom value.
- [ ] A "Confirm" button writes the final weights back to the config zone (`topSetWeight` / `backoffWeight` columns) in the Google Sheet.
- [ ] After confirmation, the app navigates to the workout list (or the existing "Workout Complete" summary).
- [ ] Exercises that share the same underlying `liftId` are grouped so the user sees one progression decision per lift, not per exercise row.
- [ ] Secondary lifts are not shown on the progression page.

## Scope

### In scope
- Progression review page UI (list of lifts with current → proposed weight)
- Evaluation logic: compare actual reps to rep-range upper bound
- Editable proposed weights
- Writing updated config values back to the sheet
- Navigation flow: Finish → Review → Confirm → Workout list

### Out of scope
- Deload / reset logic (weight decreases on repeated failures)
- History of progression decisions
- Undo / rollback after confirmation
- Changing the increment value from this page

## Notes

- The progression check should look at the **work** and **backoff** set types specifically (not warmup sets).
- For work sets, compare against `topSetWeight`; for backoff sets, compare against `backoffWeight`.
- Secondary lifts always derive their weights from a primary lift's config via cross-reference percentages. They have no independent progression — updating the primary automatically updates the secondary on the next load.
- If a lift appears multiple times across exercises (e.g. the same `liftId` as both primary and assistance), surface it once with the most relevant progression signal.
- The `increment` field already exists on `LiftConfig` and is read from the sheet — no schema changes needed.
