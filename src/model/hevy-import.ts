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

/** Pad a number to 2 digits. */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format a Date object as ISO 8601 local date-time (YYYY-MM-DDTHH:MM:SS). */
function formatLocalISO(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** Format a Date object as ISO 8601 date (YYYY-MM-DD). */
function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Parse a timestamp string into ISO 8601 local date-time.
 * Handles multiple formats:
 *   "2025-01-15 08:30:00" → "2025-01-15T08:30:00"
 *   "2025-01-15T08:30:00" → "2025-01-15T08:30:00" (unchanged)
 *   "Jan 15, 2025 8:30 AM" → "2025-01-15T08:30:00"
 *   "15 Jan 2025 08:30" → "2025-01-15T08:30:00"
 * Returns '' for empty/unparseable input.
 */
export function toISOTimestamp(ts: string): string {
  if (!ts) return '';
  const trimmed = ts.trim();

  // Fast path: already ISO 8601 with T separator
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return trimmed;

  // Common Hevy format: "YYYY-MM-DD HH:MM:SS"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(trimmed)) {
    return trimmed.replace(' ', 'T');
  }

  // Try Date constructor for other formats (e.g., "Jan 15, 2025 8:30 AM")
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return formatLocalISO(d);
  }

  // Fallback: return as-is
  return trimmed;
}

/**
 * Parse a date string into ISO 8601 date (YYYY-MM-DD).
 * Handles multiple formats:
 *   "2025-01-15" → "2025-01-15" (unchanged)
 *   "Jan 15, 2025" → "2025-01-15"
 *   "01/15/2025" → "2025-01-15"
 * Returns '' for empty/unparseable input.
 */
export function toISODate(dateStr: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();

  // Fast path: already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.substring(0, 10);

  // Try Date constructor for other formats
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return formatLocalDate(d);
  }

  // Fallback: return first 10 chars
  return trimmed.substring(0, 10);
}

/**
 * Extract a YYYY-MM-DD date string from either a Workout Date column
 * or by parsing from the Workout Start timestamp.
 * All values are normalized to ISO 8601 format.
 */
function extractDate(row: HevyRow): string {
  if (row.workoutDate) {
    return toISODate(row.workoutDate);
  }
  if (row.workoutStart) {
    // Parse as a full timestamp, then extract the date portion
    const ts = toISOTimestamp(row.workoutStart);
    return ts.substring(0, 10);
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
    const startTime = toISOTimestamp(row.workoutStart);
    const endTime = toISOTimestamp(row.workoutEnd);
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
