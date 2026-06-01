# Feature: Motivational Quotes on Home Screen

> Display a random motivational quote on the workout selection screen to set the tone before each session.

## What

The home screen (workout selection) shows a motivational quote between the banner and the workout list. Each time the app loads, a random quote is selected from a curated set and displayed in a neon cursive style — pink glowing text for the quote, cyan for the author — evoking a nightclub-sign aesthetic that matches the app's dark theme.

Quotes are stored as static JSON data (text + author pairs). The component picks one at random on mount, so the user sees a fresh quote each visit without any network calls or state management.

## Acceptance Criteria

- [ ] A motivational quote appears below the banner on the workout selection screen
- [ ] Quote is randomly selected from a set of at least 10 quotes on each app load
- [ ] Quote text is displayed in a cursive font with a neon glow effect
- [ ] Author attribution is shown beneath the quote text in a distinct color
- [ ] Quote data lives in a standalone JSON file, not hardcoded in the component
- [ ] The font loads without blocking the app's initial render

## Scope

### In scope
- Static JSON quote bank (text + author)
- Random quote selection component
- Neon cursive styling with glow effects
- Integration into the workout selection screen

### Out of scope
- User-configurable quotes or favorites
- Daily-quote logic (same quote all day) — current behavior is random per mount
- Fetching quotes from an external API
- Animation or transition effects on the quote

## Notes

- The cursive font (Pacifico via Google Fonts) is a new external dependency; it should be loaded in a non-blocking way to avoid layout shift.
- "Random per mount" means the quote can change on navigation — this is intentional and acceptable for a personal tool.
- The quote set is small enough to live in the repo as static data; no build-time generation needed.
