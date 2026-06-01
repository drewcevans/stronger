/**
 * Stronger app configuration.
 * Data is served via Google Apps Script webhook — no OAuth required.
 */

/** Apps Script web app URL — all data reads and writes go here. */
export const API_URL = 'https://script.google.com/macros/s/AKfycbwbDZ90Z1yPHjIJ7fCcmXlCjyajWhPmhPcT0nB9FMpCohIwnRcoqeu2Vta8HvzXBLAAfA/exec'

/** Name of the tab the app targets for lift configurations. */
export const TARGET_TAB_NAME = 'Exercises'

/** Name of the tab that holds workout definitions (exercise structure). */
export const WORKOUT_DEFS_TAB_NAME = 'Workouts'

/** Name of the tab that holds the workout log (completed set data). */
export const LOG_TAB_NAME = 'Log'

/** Name of the tab that holds the workout schedule (date→workoutId mapping). */
export const SCHEDULE_TAB_NAME = 'Schedule'

/** Name of the tab that holds cardio activity definitions (id + name). */
export const CARDIO_TAB_NAME = 'Cardio'

/** Name of the tab that holds nutrition logging. */
export const NUTRITION_TAB_NAME = 'Nutrition'

/** Name of the tab that holds body composition stats. */
export const BODY_STATS_TAB_NAME = 'Body Stats'