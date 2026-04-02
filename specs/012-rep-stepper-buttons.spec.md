# Feature: Rep count stepper buttons

> Add +/− tap buttons next to the reps input for quick single-tap adjustments on a phone.

## What

On the workout execution page, each set row has a text input for reps. Typing precise numbers on a phone keyboard is clunky mid-set. This feature adds a small vertically-stacked +/− button pair immediately to the right of the reps input. Tapping + increments the rep count by 1; tapping − decrements by 1 (minimum 0). The text input stays editable for direct entry, and the buttons and input stay in sync.

The buttons should be compact — stacked vertically with + on top and − on bottom — sized to be comfortably tappable on a phone but not so large that they crowd the set row layout.

## Acceptance Criteria

- [ ] A +/− button pair appears to the right of the reps text input on each set row.
- [ ] Tapping + increments the displayed rep count by 1.
- [ ] Tapping − decrements the displayed rep count by 1, with a floor of 0.
- [ ] The text input value stays in sync with button taps, and direct text edits are still supported.
- [ ] Buttons are stacked vertically (+ above −) and sized for comfortable phone tapping (~28–36px tap targets).
- [ ] The stepper does not significantly widen or break the existing set row layout.

## Scope

### In scope
- +/− stepper buttons for the reps field
- Sync between stepper and text input
- Phone-friendly tap targets

### Out of scope
- Stepper buttons for the weight field (can be a follow-up if useful)
- Long-press repeat / hold-to-increment behavior
- Haptic feedback

## Notes

- Only the reps field gets steppers — weight changes are less frequent and benefit from direct numeric entry.
- Keep the buttons visually subtle (muted color, small text) so they don't dominate the row.
