# Feature: App logo and banner

> Add an art-deco "S" logo/icon and a "STRONGER" banner to the landing page to establish visual identity without cluttering the workout execution view.

## What

The app needs a visual identity. The logo is a stylized "S" in an art-deco style — geometric, angular, evoking progress and individual strength. This serves as both the app icon (favicon, PWA icon if ever needed) and an in-app mark.

The landing page (workout selection screen) displays a banner with the word "STRONGER" in an art-deco typographic treatment, paired with the logo. This sets the tone when the lifter opens the app. The banner is only shown on the landing/selection page — the workout execution page stays clean and utilitarian with no branding elements.

The art-deco style should be consistent with the lift icons (spec 009): hard edges, geometric forms, bold lines, stepped/radiating motifs. Think achievement and progress — upward angles, confident geometry.

## Acceptance Criteria

- [ ] An art-deco "S" logo exists as an inline SVG, usable as both an in-page element and a favicon.
- [ ] The favicon is set to the "S" logo.
- [ ] The landing page displays a "STRONGER" banner with art-deco typographic styling, paired with the logo.
- [ ] The banner is only visible on the workout selection / landing page.
- [ ] The workout execution page has no banner or logo — remains clean and utilitarian.
- [ ] The logo and banner render well on mobile at various widths (no overflow or truncation).

## Scope

### In scope
- Art-deco "S" logo as inline SVG
- "STRONGER" banner with art-deco typography for the landing page
- Setting the favicon to the logo
- Ensuring the banner is absent from the workout execution view

### Out of scope
- PWA manifest or app icon sizes
- Dark mode variants
- Splash screen or loading animation
- Marketing or about page

## Notes

- The "STRONGER" text treatment can be CSS-styled text or SVG — whichever looks better and stays crisp. If using a web font, keep it to one weight to minimize load.
- Style reference: the same WPA / Chrysler Building aesthetic from spec 009. The "S" could incorporate stepped forms, radiating lines, or chevron motifs that suggest upward movement.
