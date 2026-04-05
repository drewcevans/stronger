/**
 * Hevy CSV import — parse a Hevy CSV export and convert rows to Stronger log format.
 *
 * The CSV is parsed client-side with a simple split-based parser (no library needed).
 * Each row is mapped to the 18-column Stronger log format per the spec.
 */

/* ------------------------------------------------------------------ */
/*  Hevy CSV types                                                     */
/* ------------------------------------------------------------------ */

/** Raw column names in a Hevy CSV export. */
const HEVY_COLUMNS = [
  'Workout Name',
  'Workout Start',
  'Workout End',
  'Workout Notes',
  'Exercise Name',
  'Set Order',
  'Weight (kg)',
  'Reps',
  'Distance (meters)',
  'Seconds',
  'Weight System',
  'Set Type',
  'Exercise Category',
  'Exercise Comments',
  'Rest Time',
  'Workout Duration',
  'Workout Date',
] as const;

/** One parsed row from the Hevy CSV. All values are strings before conversion. */
interface HevyRow {
  workoutName: string;
  workoutStart: string;
  workoutEnd: string;
  exerciseName: string;
  setOrder: string;
  weightKg: string;
  reps: string;
  distanceMeters: string;
  seconds: string;
  weightSystem: string;
  setType: string;
  workoutDate: string;
}

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

/** Summary shown to the user before confirming the import. */
export interface ImportSummary {
  dateRange: { start: string; end: string };
  totalSets: number;
  uniqueExercises: number;
  workoutCount: number;
}

/* ------------------------------------------------------------------ */
/*  CSV parsing                                                        */
/* ------------------------------------------------------------------ */

/**
 * Parse a CSV string that may contain quoted fields (with embedded commas,
 * newlines, and escaped quotes).
 */
export function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let i = 0;
  const len = csvText.length;

  while (i < len) {
    const { fields, nextIndex } = parseCsvLine(csvText, i);
    rows.push(fields);
    i = nextIndex;
  }

  return rows;
}

function parseCsvLine(
  text: string,
  start: number,
): { fields: string[]; nextIndex: number } {
  const fields: string[] = [];
  let i = start;
  const len = text.length;

  while (i < len) {
    if (text[i] === '"') {
      // Quoted field
      let value = '';
      i++; // skip opening quote
      while (i < len) {
        if (text[i] === '"') {
          if (i + 1 < len && text[i + 1] === '"') {
            value += '"';
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          value += text[i];
          i++;
        }
      }
      fields.push(value);
      // Skip comma or end-of-line
      if (i < len && text[i] === ',') {
        i++;
      } else {
        // end of line
        if (i < len && text[i] === '\r') i++;
        if (i < len && text[i] === '\n') i++;
        break;
      }
    } else {
      // Unquoted field — find next comma or newline
      const commaIdx = text.indexOf(',', i);
      const crIdx = text.indexOf('\r', i);
      const lfIdx = text.indexOf('\n', i);
      // Find the nearest delimiter
      let endIdx = len;
      let isEol = true;
      if (commaIdx >= 0 && commaIdx < endIdx) {
        endIdx = commaIdx;
        isEol = false;
      }
      if (crIdx >= 0 && crIdx < endIdx) {
        endIdx = crIdx;
        isEol = true;
      }
      if (lfIdx >= 0 && lfIdx < endIdx) {
        endIdx = lfIdx;
        isEol = true;
      }

      fields.push(text.substring(i, endIdx));

      if (isEol) {
        i = endIdx;
        if (i < len && text[i] === '\r') i++;
        if (i < len && text[i] === '\n') i++;
        break;
      } else {
        i = endIdx + 1; // skip comma
      }
    }
  }

  return { fields, nextIndex: i };
}

/**
 * Parse a Hevy CSV export into structured rows.
 * Throws if the header row doesn't contain the expected columns.
 */
export function parseHevyCsv(csvText: string): HevyRow[] {
  const allRows = parseCsvRows(csvText);
  if (allRows.length === 0) {
    throw new Error('CSV file is empty.');
  }

  const headerRow = allRows[0].map((h) => h.trim());

  // Build column index map — match Hevy column names to positions
  const colIndex = new Map<string, number>();
  for (const col of HEVY_COLUMNS) {
    const idx = headerRow.indexOf(col);
    if (idx >= 0) colIndex.set(col, idx);
  }

  // Require at minimum the essential columns
  const required = ['Exercise Name', 'Set Order', 'Workout Name'] as const;
  for (const r of required) {
    if (!colIndex.has(r)) {
      throw new Error(`Missing required column: "${r}". Is this a Hevy CSV export?`);
    }
  }

  const get = (row: string[], col: string): string => {
    const idx = colIndex.get(col);
    return idx !== undefined && idx < row.length ? row[idx].trim() : '';
  };

  const result: HevyRow[] = [];
  for (let i = 1; i < allRows.length; i++) {
    const row = allRows[i];
    // Skip empty rows
    if (row.length === 0 || (row.length === 1 && row[0].trim() === '')) continue;

    result.push({
      workoutName: get(row, 'Workout Name'),
      workoutStart: get(row, 'Workout Start'),
      workoutEnd: get(row, 'Workout End'),
      exerciseName: get(row, 'Exercise Name'),
      setOrder: get(row, 'Set Order'),
      weightKg: get(row, 'Weight (kg)'),
      reps: get(row, 'Reps'),
      distanceMeters: get(row, 'Distance (meters)'),
      seconds: get(row, 'Seconds'),
      weightSystem: get(row, 'Weight System'),
      setType: get(row, 'Set Type'),
      workoutDate: get(row, 'Workout Date'),
    });
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Mapping helpers                                                    */
/* ------------------------------------------------------------------ */

/** Slugify a string: lowercase, replace non-alphanumeric with hyphens, collapse. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Map a Hevy set type to a Stronger set type. */
function mapSetType(hevyType: string): string {
  const lower = hevyType.toLowerCase().trim();
  if (lower === 'warmup' || lower === 'warm up') return 'warmup';
  return 'work';
}

/** Convert kg to lbs, rounded to nearest 0.5. */
export function kgToLbs(kg: number): number {
  const lbs = kg * 2.20462;
  return Math.round(lbs * 2) / 2;
}

/** Convert meters to miles. */
export function metersToMiles(meters: number): number {
  return meters / 1609.34;
}

/**
 * Parse a Hevy timestamp into ISO 8601 local time.
 * Hevy timestamps look like "2025-01-15 08:30:00".
 * We treat them as local time and format as ISO 8601.
 */
function parseTimestamp(ts: string): string {
  if (!ts) return '';
  // Replace space with T for ISO format
  const trimmed = ts.trim();
  // If already has T, return as-is
  if (trimmed.includes('T')) return trimmed;
  // "2025-01-15 08:30:00" → "2025-01-15T08:30:00"
  return trimmed.replace(' ', 'T');
}

/**
 * Extract a YYYY-MM-DD date string from either a Workout Date column
 * or by parsing from the Workout Start timestamp.
 */
function extractDate(row: HevyRow): string {
  if (row.workoutDate) {
    // workoutDate should already be YYYY-MM-DD
    return row.workoutDate.trim().substring(0, 10);
  }
  if (row.workoutStart) {
    return row.workoutStart.trim().substring(0, 10);
  }
  return '';
}

/**
 * Determine if a row should be categorized as cardio.
 * Cardio if distance/seconds is populated AND weight is empty/zero.
 */
function isCardioRow(row: HevyRow): boolean {
  const weight = parseFloat(row.weightKg) || 0;
  const distance = parseFloat(row.distanceMeters) || 0;
  const seconds = parseFloat(row.seconds) || 0;
  return weight === 0 && (distance > 0 || seconds > 0);
}

/* ------------------------------------------------------------------ */
/*  Main conversion                                                    */
/* ------------------------------------------------------------------ */

/**
 * Convert parsed Hevy rows into Stronger log rows (18-column format).
 * Returns raw arrays ready for appendLogRows().
 */
export function convertHevyRows(
  rows: HevyRow[],
): (string | number | boolean)[][] {
  return rows.map((row) => {
    const date = extractDate(row);
    const startTime = parseTimestamp(row.workoutStart);
    const endTime = parseTimestamp(row.workoutEnd);
    const workoutId = slugify(row.workoutName);
    const exerciseName = row.exerciseName;
    const liftId = slugify(row.exerciseName);
    const setNumber = parseInt(row.setOrder, 10) || 1;
    const setType = mapSetType(row.setType);

    const rawWeight = parseFloat(row.weightKg) || 0;
    const isMetric = row.weightSystem.toLowerCase().trim() !== 'imperial';
    const weight = rawWeight > 0 && isMetric ? kgToLbs(rawWeight) : rawWeight;

    const reps = parseInt(row.reps, 10) || 0;
    const cardio = isCardioRow(row);
    const category = cardio ? 'cardio' : 'strength';

    // Cardio-specific fields
    const seconds = parseFloat(row.seconds) || 0;
    const distanceMeters = parseFloat(row.distanceMeters) || 0;
    const duration = cardio && seconds > 0 ? seconds / 60 : '';
    const distance = cardio && distanceMeters > 0 ? Math.round(metersToMiles(distanceMeters) * 100) / 100 : '';

    return [
      date,
      startTime,
      endTime,
      workoutId,
      exerciseName,
      liftId,
      setNumber,
      setType,
      weight,        // plannedWeight = actualWeight
      reps,          // plannedReps = actualReps
      weight,        // actualWeight
      reps,          // actualReps
      'TRUE',        // completed
      category,
      duration,
      distance,
      '',            // elevation (not available)
      '',            // cardioWeight (not available)
    ];
  });
}

/**
 * Compute a summary of the parsed Hevy data for preview display.
 */
export function computeImportSummary(rows: HevyRow[]): ImportSummary {
  const dates = rows.map((r) => extractDate(r)).filter(Boolean).sort();
  const exercises = new Set(rows.map((r) => r.exerciseName));
  const workouts = new Set(
    rows.map((r) => {
      const date = extractDate(r);
      const name = r.workoutName;
      return `${date}|${name}`;
    }),
  );

  return {
    dateRange: {
      start: dates[0] ?? '',
      end: dates[dates.length - 1] ?? '',
    },
    totalSets: rows.length,
    uniqueExercises: exercises.size,
    workoutCount: workouts.size,
  };
}
