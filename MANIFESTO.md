# Stronger

## Purpose

A personal fitness app for planning and executing strength-training workouts. It replaces ad-hoc spreadsheet tracking with a phone-friendly UI while keeping Google Sheets as the single source of truth for all data.

## Vision

Load up the GitHub Pages site on your phone, pick today's planned workout, and go. Workout protocols are defined as prompts that generate structured plans into the spreadsheet. The app reads those plans and provides a clean interface to work through sets, reps, and weights in the gym.

## Principles

- **Google Sheets is the database**: All workout data lives in a Google Sheet. No server, no database, no syncing layer. The sheet is both storage and a human-readable audit trail.
- **Client-only deployment**: The entire app is a static site on GitHub Pages. No backend services to maintain or pay for.
- **No user accounts**: There is no app-level user management. Google OAuth is used solely to authenticate with the Sheets API — the app itself has no concept of users, profiles, or multi-tenancy.
- **Prompt-driven programming**: Workout protocols (e.g., 5/3/1, linear progression) are defined as reusable prompts that populate the spreadsheet with planned workouts. Adding a new program means writing a new prompt, not new app code.
- **Phone-first UI**: The primary use case is standing in a gym holding a phone. The interface must be thumb-friendly and readable at arm's length.

## Tech Stack

- **Frontend**: TypeScript + React
- **Build**: Bundled for production deploy to GitHub Pages; live-transpiled during development
- **Data**: Google Sheets API (read/write via OAuth)
- **Hosting**: GitHub Pages (static)

## Scope

### What this project is

- A workout tracker that reads planned workouts from a Google Sheet
- A phone-friendly UI for executing a workout (sets, reps, weights, rest timers)
- A prompt-based system for generating workout plans into the spreadsheet

### What this project is not

- A social or sharing platform
- A nutrition or diet tracker
- An exercise library with video demos
- A multi-user application

## Target Users

Just me. This is a personal tool built to my preferences. If it's useful to others, great, but that's not a design constraint.
