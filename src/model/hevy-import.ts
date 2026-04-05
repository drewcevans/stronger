/**
 * Hevy CSV import — parse a Hevy CSV export and convert rows to Stronger log format.
 *
 * The CSV is parsed client-side with a simple split-based parser (no library needed).
 * Each row is mapped to the 18-column Stronger log format per the spec.
 */

/* ------------------------------------------------------------------ */
/*  Hevy CSV types                                                     */
/* ------------------------------------------------------------------ */

/**
 * Column aliases: each internal field maps to possible CSV header names.
 * The old Hevy format (pre-2025) used Title Case names and metric units.
 * The new format uses snake_case names and imperial units.
 *
 * The first matching alias wins. The matched header name is used to detect
 * the unit system: 'weight_lbs' → already in lbs, 'Weight (kg)' → needs
 * kg-to-lbs conversion; 'distance_miles' → already in miles,
 * 'Distance (meters)' → needs meters-to-miles conversion.
 */
const COLUMN_ALIASES: Record<string, string[]> = {
  workoutName: ['title', 'Workout Name'],
  workoutStart: ['start_time', 'Workout Start'],
  workoutEnd: ['end_time', 'Workout End'],
  exerciseName: ['exercise_title', 'Exercise Name'],
  setOrder: ['set_index', 'Set Order'],
  weight: ['weight_lbs', 'Weight (kg)'],
  reps: ['reps', 'Reps'],
  distance: ['distance_miles', 'Distance (meters)'],
  seconds: ['duration_seconds', 'Seconds'],
  setType: ['set_type', 'Set Type'],
  weightSystem: ['Weight System'],
  workoutDate: ['Workout Date'],
};

/** One parsed row from the Hevy CSV. All values are strings before conversion. */
export interface HevyRow {
  workoutName: string;
  workoutStart: string;
  workoutEnd: string;
  exerciseName: string;
  setOrder: string;
  weight: string;
  reps: string;
  distance: string;
  seconds: string;
  weightSystem: string;
  setType: string;
  workoutDate: string;
  /** True when the weight column is already in lbs (new format). */
  weightInLbs: boolean;
  /** True when the distance column is already in miles (new format). */
  distanceInMiles: boolean;
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
 * Detect the delimiter used in a CSV/TSV file by checking the first line.
 * If tabs outnumber commas, assume TSV; otherwise CSV.
 */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return tabs > commas ? '\t' : ',';
}

/**
 * Parse a CSV/TSV string that may contain quoted fields (with embedded
 * delimiters, newlines, and escaped quotes).  The delimiter is auto-detected
 * from the first line (tab vs comma).
 */
export function parseCsvRows(csvText: string): string[][] {
  const delimiter = detectDelimiter(csvText);
  const rows: string[][] = [];
  let i = 0;
  const len = csvText.length;

  while (i < len) {
    const { fields, nextIndex } = parseCsvLine(csvText, i, delimiter);
    rows.push(fields);
    i = nextIndex;
  }

  return rows;
}

function parseCsvLine(
  text: string,
  start: number,
  delimiter: string,
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
      // Skip delimiter or end-of-line
      if (i < len && text[i] === delimiter) {
        i++;
      } else {
        // end of line
        if (i < len && text[i] === '\r') i++;
        if (i < len && text[i] === '\n') i++;
        break;
      }
    } else {
      // Unquoted field — find next delimiter or newline
      const delimIdx = text.indexOf(delimiter, i);
      const crIdx = text.indexOf('\r', i);
      const lfIdx = text.indexOf('\n', i);
      // Find the nearest delimiter
      let endIdx = len;
      let isEol = true;
      if (delimIdx >= 0 && delimIdx < endIdx) {
        endIdx = delimIdx;
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
        i = endIdx + 1; // skip delimiter
      }
    }
  }

  return { fields, nextIndex: i };
}

/**
 * Parse a Hevy CSV/TSV export into structured rows.
 * Supports both old (Title Case, metric) and new (snake_case, imperial) formats.
 * Throws if the header row doesn't contain the expected columns.
 */
export function parseHevyCsv(csvText: string): HevyRow[] {
  const allRows = parseCsvRows(csvText);
  if (allRows.length === 0) {
    throw new Error('CSV file is empty.');
  }

  const headerRow = allRows[0].map((h) => h.trim());

  // Build column index map using aliases
  const colIndex = new Map<string, number>();
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const idx = headerRow.indexOf(alias);
      if (idx >= 0) {
        colIndex.set(field, idx);
        break;
      }
    }
  }

  // Require at minimum the essential columns
  const required = ['exerciseName', 'setOrder', 'workoutName'] as const;
  for (const r of required) {
    if (!colIndex.has(r)) {
      const aliases = COLUMN_ALIASES[r]?.join('" or "') ?? r;
      throw new Error(`Missing required column: "${aliases}". Is this a Hevy CSV export?`);
    }
  }

  // Detect units from which column header was matched
  const weightColName = (() => {
    const idx = colIndex.get('weight');
    return idx !== undefined ? headerRow[idx] : '';
  })();
  const weightInLbs = weightColName === 'weight_lbs';

  const distColName = (() => {
    const idx = colIndex.get('distance');
    return idx !== undefined ? headerRow[idx] : '';
  })();
  const distanceInMiles = distColName === 'distance_miles';

  const get = (row: string[], field: string): string => {
    const idx = colIndex.get(field);
    return idx !== undefined && idx < row.length ? row[idx].trim() : '';
  };

  const result: HevyRow[] = [];
  for (let i = 1; i < allRows.length; i++) {
    const row = allRows[i];
    // Skip empty rows
    if (row.length === 0 || (row.length === 1 && row[0].trim() === '')) continue;

    result.push({
      workoutName: get(row, 'workoutName'),
      workoutStart: get(row, 'workoutStart'),
      workoutEnd: get(row, 'workoutEnd'),
      exerciseName: get(row, 'exerciseName'),
      setOrder: get(row, 'setOrder'),
      weight: get(row, 'weight'),
      reps: get(row, 'reps'),
      distance: get(row, 'distance'),
      seconds: get(row, 'seconds'),
      weightSystem: get(row, 'weightSystem'),
      setType: get(row, 'setType'),
      workoutDate: get(row, 'workoutDate'),
      weightInLbs,
      distanceInMiles,
    });
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Mapping helpers                                                    */
/* ------------------------------------------------------------------ */

/** Strip parenthetical suffixes like "(Dumbbell)" or "(Barbell)" from a name. */
export function stripParentheticals(name: string): string {
  return name.replace(/\s*\([^)]*\)/g, '').trim();
}

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
  const weight = parseFloat(row.weight) || 0;
  const distance = parseFloat(row.distance) || 0;
  const seconds = parseFloat(row.seconds) || 0;
  return weight === 0 && (distance > 0 || seconds > 0);
}

/* ------------------------------------------------------------------ */
/*  Main conversion                                                    */
/* ------------------------------------------------------------------ */

/**
 * Convert parsed Hevy rows into Stronger log rows (18-column format).
 * Returns raw arrays ready for appendLogRows().
 *
 * Hevy does not track planned vs. actual weight/reps separately, so
 * both planned and actual columns are set to the same value.
 *
 * Unit handling:
 * - New format (weight_lbs / distance_miles): values are already in lbs/miles.
 * - Old format (Weight (kg) / Distance (meters)): converted based on Weight System.
 */
export function convertHevyRows(
  rows: HevyRow[],
): (string | number | boolean)[][] {
  return rows.map((row) => {
    const date = extractDate(row);
    const startTime = parseTimestamp(row.workoutStart);
    const endTime = parseTimestamp(row.workoutEnd);
    const workoutId = slugify(row.workoutName);
    const exerciseName = stripParentheticals(row.exerciseName);
    const liftId = slugify(exerciseName);
    const setNumber = parseInt(row.setOrder, 10) || 1;
    const setType = mapSetType(row.setType);

    const rawWeight = parseFloat(row.weight) || 0;
    let weight: number;
    if (row.weightInLbs) {
      // New format: already in lbs
      weight = rawWeight;
    } else {
      // Old format: convert from kg to lbs unless already imperial
      const isMetric = row.weightSystem.toLowerCase().trim() !== 'imperial';
      weight = rawWeight > 0 && isMetric ? kgToLbs(rawWeight) : rawWeight;
    }

    const reps = parseInt(row.reps, 10) || 0;
    const cardio = isCardioRow(row);
    const category = cardio ? 'cardio' : 'strength';

    // Cardio-specific fields
    const seconds = parseFloat(row.seconds) || 0;
    const rawDistance = parseFloat(row.distance) || 0;
    const duration = cardio && seconds > 0 ? seconds / 60 : '';

    let distance: number | string = '';
    if (cardio && rawDistance > 0) {
      if (row.distanceInMiles) {
        // New format: already in miles
        distance = Math.round(rawDistance * 100) / 100;
      } else {
        // Old format: convert meters to miles
        distance = Math.round(metersToMiles(rawDistance) * 100) / 100;
      }
    }

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
  const exercises = new Set(rows.map((r) => stripParentheticals(r.exerciseName)));
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
