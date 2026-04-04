# Feature: Weight stepper buttons on progression page

> Add +/− tap buttons to the weight inputs on the progression review page, incrementing/decrementing by the lift's round-to value.

## What

The progression review page currently uses plain text inputs for the proposed top-set and backoff weights. On a phone, editing these values requires opening the keyboard and typing a precise number — awkward when you just want to bump a weight up or down by one increment.

This feature adds horizontal +/− stepper buttons around each weight input, matching the pattern already used for rep steppers on the workout page. Tapping + adds the lift's `roundTo` value to the displayed weight; tapping − subtracts it (with a floor of 0). The text input remains editable for direct entry. The step size is per-lift, driven by the existing `roundTo` field on `LiftConfig`.

## Acceptance Criteria

- [ ] A −/+ button pair appears around each weight input on the progression review page (− left, + right).
- [ ] Tapping + increments the weight by the lift's `roundTo` value.
- [ ] Tapping − decrements the weight by the lift's `roundTo` value, with a floor of 0.
- [ ] The text input stays in sync with button taps, and direct text edits are still supported.
- [ ] Buttons are sized for comfortable phone tapping, matching the rep stepper style from the workout page.
- [ ] Both the top-set weight and backoff weight fields (when present) get stepper buttons.

## Scope

### In scope
- +/− stepper buttons for weight fields on the progression review page
- Step size driven by `roundTo` from the lift's config
- Sync between steppers and text input
- Consistent styling with the existing rep steppers

### Out of scope
- Weight steppers on the workout execution page
- Changing the `roundTo` value from this page
- Long-press repeat / hold-to-increment behavior

## Notes

- Reuse the same button styling and layout pattern from the rep steppers (spec 012) for consistency.
- The `roundTo` value is already available on `LiftConfig` and passed through the progression proposals — no schema changes needed.
- If `roundTo` is missing or zero for a lift, fall back to an increment of 5 (standard plate increment).
