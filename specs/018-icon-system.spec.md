# Feature: Icon system

> Adopt a standard icon set so the app has consistent, recognizable icons for navigation, actions, and calendar entries.

## What

As the app grows beyond a flat workout list — adding a calendar view, sync buttons, navigation, activity types — it needs a consistent set of icons. Today there are no general-purpose icons; lift badges (spec 009) use custom SVGs specific to exercises.

This spec adds a web-hosted icon set (e.g., Material Symbols, Lucide, Phosphor) as a project dependency and replaces or augments hardcoded glyphs with icons from the set. The initial rollout covers the icons most immediately needed: navigation (back, menu), actions (add, remove, sync/refresh), and calendar-related UI (calendar, event).

## Acceptance Criteria

- [ ] A single icon set is adopted as a project dependency.
- [ ] Icons render correctly at multiple sizes and are legible on phone screens.
- [ ] Icons are used for at least: back/navigation, add, remove, and calendar.
- [ ] Icons follow a consistent visual style (weight, fill, size) throughout the app.
- [ ] The icon set supports tree-shaking or on-demand loading so unused icons don't bloat the bundle.

## Scope

### In scope
- Choosing and installing one icon set
- Establishing a consistent usage pattern (size, weight, color conventions)
- Replacing existing text-based or emoji-based actions with icons where they already exist
- Adding icons to navigation and action buttons

### Out of scope
- Custom/bespoke icon design
- Replacing the lift badge SVGs (spec 009) — those are exercise-specific and stay as-is
- Iconography for future activity types (running, climbing, etc.) — those will use this system but are added in their own spec

## Notes

- Popular options that work well as direct imports in a React/Vite project: Material Symbols (`@material-symbols/svg-400`), Lucide (`lucide-react`), Phosphor (`@phosphor-icons/react`). Any of these is fine — pick one that has good coverage and feels right with the app's visual style.
- The manifesto emphasizes phone-first UI. Icons should be thumb-sized touch targets (minimum 44×44 CSS pixels for tappable elements) and high-contrast.
- This is a foundational spec — once the icon set is in place, subsequent specs (calendar view, sync, activity types) can reference it without further setup.
