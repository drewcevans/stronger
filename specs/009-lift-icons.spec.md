# Feature: Primary lift icons on workout selection

> Display art-deco SVG icons for each workout's primary lift on the selection screen, with a fallback barbell icon for unknown lifts.

## What

The workout selection screen currently shows workout IDs (A, B, C, D) in circles. Replace these with SVG icons representing each workout's primary lift: bench press, squat, overhead press, and deadlift. A fifth "unknown" icon — a simple barbell — serves as the fallback for any future workout whose primary lift doesn't have a dedicated icon.

The icons should have a bold, art-deco style: hard geometric edges, strong lines, and a feeling of progress and strength. Think WPA poster aesthetic — angular, confident, minimal detail.

Icon assignment is based on the primary lift name, not the workout ID. If Workout A's primary lift is "Bench Press" and an icon exists for that lift, it gets the bench icon. If a new workout is added with a primary lift that has no icon, it falls back to the barbell.

## Acceptance Criteria

- [ ] Five SVG icons exist: bench press, squat, overhead press, deadlift, and unknown (barbell).
- [ ] Icons use a consistent art-deco style: hard edges, geometric shapes, angular lines.
- [ ] The workout selection screen displays the primary lift icon in each workout's circle instead of the workout ID letter.
- [ ] Icon selection is based on the workout's primary lift name, not the workout ID.
- [ ] If no icon matches the primary lift, the unknown barbell icon is displayed.
- [ ] Icons render cleanly at the circle size on mobile (no blurring, clipping, or overflow).

## Scope

### In scope
- Creating 5 inline SVG icons (bench press, squat, overhead press, deadlift, barbell)
- Displaying icons on the workout selection screen
- Fallback logic for unrecognized primary lifts

### Out of scope
- Icons for assistance exercises or secondary lifts
- Animated icons or transitions
- User-customizable icons
- Dark mode variants (can be added later via CSS)

## Notes

- Inline SVGs are preferred over image files so they scale cleanly and can be styled with CSS (e.g., color changes for dark mode later).
- The icon-to-lift mapping should be a simple lookup by primary lift name string. Keep it extensible — adding a new icon later is just adding an entry to the map.
- Art-deco reference: geometric symmetry, bold outlines, stepped/radiating forms, minimal curves. Think Chrysler Building motifs applied to gym equipment.
