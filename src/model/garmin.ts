/**
 * Garmin activity chart data model and aggregation logic.
 *
 * Consumes activity data from the "Stronger - Garmin" sheet tab and
 * produces chart-ready data: bucketed bars, cumulative totals, and
 * prorated goal lines.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** A single Garmin activity row (subset consumed by charts). */
export interface GarminActivity {
  /** ISO date string YYYY-MM-DD */
  date: string;
  /** Activity type (e.g. "Run", "Ride", "Hike") */
  activityType: string;
  /** Duration in seconds */
  duration: number;
  /** Distance in meters */
  distance: number;
  /** Elevation gain in meters */
  elevationGain: number;
}

/** An annual goal for a single metric. */
export interface GarminGoal {
  /** 'duration' | 'distance' | 'elevationGain' */
  metric: GarminMetric;
  /** Target value in display units (hours, miles, feet) */
  value: number;
}

export type GarminMetric = 'distance' | 'elevationGain' | 'duration';

/**
 * Time range selector for activity charts.
 * - 'month': the current calendar month
 * - A 4-digit year string (e.g. '2026'): that full calendar year
 */
export type GarminTimeRange = string;

/** A single bar in the chart (one time bucket). */
export interface ChartBucket {
  /** Human-readable label for the bucket (e.g. "Mon", "W3", "Jan") */
  label: string;
  /** Aggregated metric value in display units */
  value: number;
}

/** Complete chart data for a single metric. */
export interface MetricChartData {
  metric: GarminMetric;
  buckets: ChartBucket[];
  /** Cumulative values at each bucket boundary (same length as buckets) */
  cumulative: number[];
  /** Prorated goal value for the selected time range, or null if no goal */
  proratedGoal: number | null;
  /** Display unit label */
  unit: string;
  /** Total across all buckets */
  total: number;
}

/* ------------------------------------------------------------------ */
/*  Unit conversions (storage → display)                               */
/* ------------------------------------------------------------------ */

const METERS_TO_MILES = 0.000621371;
const METERS_TO_FEET = 3.28084;
const SECONDS_TO_HOURS = 1 / 3600;

/** Convert a raw metric value from storage units to display units. */
export function toDisplayUnit(metric: GarminMetric, value: number): number {
  switch (metric) {
    case 'distance':
      return value * METERS_TO_MILES;
    case 'elevationGain':
      return value * METERS_TO_FEET;
    case 'duration':
      return value * SECONDS_TO_HOURS;
  }
}

export const METRIC_UNITS: Record<GarminMetric, string> = {
  distance: 'miles',
  elevationGain: 'feet',
  duration: 'hours',
};

export const METRIC_LABELS: Record<GarminMetric, string> = {
  distance: 'Distance',
  elevationGain: 'Elevation Gain',
  duration: 'Duration',
};

/* ------------------------------------------------------------------ */
/*  Activity classification                                            */
/* ------------------------------------------------------------------ */

/** Activity type used by Strava/Garmin for strength workouts. */
export const STRENGTH_ACTIVITY_TYPE = 'Weight Training';

/** Check if an activity type is strength training. */
export function isStrengthTraining(activityType: string): boolean {
  return activityType === STRENGTH_ACTIVITY_TYPE;
}

/** Split activities into cardio and strength training. */
export function splitActivities(activities: GarminActivity[]): {
  cardio: GarminActivity[];
  strength: GarminActivity[];
} {
  const cardio: GarminActivity[] = [];
  const strength: GarminActivity[] = [];
  for (const a of activities) {
    if (isStrengthTraining(a.activityType)) {
      strength.push(a);
    } else {
      cardio.push(a);
    }
  }
  return { cardio, strength };
}

/* ------------------------------------------------------------------ */
/*  Time range helpers                                                 */
/* ------------------------------------------------------------------ */

/** Parse a year from a range string, or null if it's 'month'. */
function parseYearRange(range: GarminTimeRange): number | null {
  if (range === 'month') return null;
  const year = parseInt(range, 10);
  return year >= 2000 ? year : null;
}

/** Get the start date (inclusive) for a time range anchored to today. */
export function getRangeStart(range: GarminTimeRange, today: Date = new Date()): Date {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);

  const year = parseYearRange(range);
  if (year !== null) {
    // Specific year: Jan 1
    return new Date(year, 0, 1);
  }
  // 'month': first of current month
  d.setDate(1);
  return d;
}

/** Get the end date (inclusive) for a time range anchored to today. */
export function getRangeEnd(range: GarminTimeRange, today: Date = new Date()): Date {
  const year = parseYearRange(range);
  if (year !== null) {
    // Specific year: Dec 31
    const end = new Date(year, 11, 31);
    end.setHours(23, 59, 59, 999);
    return end;
  }
  // 'month': last day of current month
  const d = new Date(today);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return end;
}

/* ------------------------------------------------------------------ */
/*  Activity filtering                                                 */
/* ------------------------------------------------------------------ */

/** Get unique activity types from the data. */
export function getActivityTypes(activities: GarminActivity[]): string[] {
  return [...new Set(activities.map((a) => a.activityType))].sort();
}

/** Filter activities by date range and activity types. */
export function filterActivities(
  activities: GarminActivity[],
  range: GarminTimeRange,
  selectedTypes: Set<string>,
  today: Date = new Date(),
): GarminActivity[] {
  const start = getRangeStart(range, today);
  const end = getRangeEnd(range, today);
  const startStr = toISODate(start);
  const endStr = toISODate(end);

  return activities.filter(
    (a) =>
      a.date >= startStr &&
      a.date <= endStr &&
      selectedTypes.has(a.activityType),
  );
}

/* ------------------------------------------------------------------ */
/*  Bucketing                                                          */
/* ------------------------------------------------------------------ */

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Build the list of time range options: Month, then the current year and 5 prior years. */
export function getTimeRangeOptions(today: Date = new Date()): { value: GarminTimeRange; label: string }[] {
  const currentYear = today.getFullYear();
  return [
    { value: 'month', label: 'Month' },
    ...Array.from({ length: 6 }, (_, i) => ({
      value: String(currentYear - i),
      label: String(currentYear - i),
    })),
  ];
}

/** Get ISO week number for a date. */
function getISOWeek(d: Date): number {
  const tmp = new Date(d.getTime());
  tmp.setHours(0, 0, 0, 0);
  // Thursday of this week
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const jan4 = new Date(tmp.getFullYear(), 0, 4);
  return 1 + Math.round(((tmp.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}

/**
 * Assign a bucket key to an activity based on the time range.
 * - month: ISO week number "W{n}"
 * - year: month index "0"-"11"
 */
function getBucketKey(dateStr: string, range: GarminTimeRange): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (range === 'month') {
    return `W${getISOWeek(d)}`;
  }
  // Year range → monthly buckets
  return String(d.getMonth());
}

/** Generate all expected bucket keys and labels for a time range. */
export function generateBucketSlots(
  range: GarminTimeRange,
  today: Date = new Date(),
): { key: string; label: string }[] {
  if (range === 'month') {
    // Weekly buckets for the current month
    const start = getRangeStart(range, today);
    const end = getRangeEnd(range, today);
    const slots: { key: string; label: string }[] = [];
    const seen = new Set<string>();
    const cursor = new Date(start);
    while (cursor <= end) {
      const wk = getISOWeek(cursor);
      const key = `W${wk}`;
      if (!seen.has(key)) {
        seen.add(key);
        slots.push({ key, label: `W${wk}` });
      }
      cursor.setDate(cursor.getDate() + 7);
    }
    // Also check the end date's week
    const endWk = getISOWeek(end);
    const endKey = `W${endWk}`;
    if (!seen.has(endKey)) {
      slots.push({ key: endKey, label: `W${endWk}` });
    }
    return slots;
  }

  // Year range → 12 monthly buckets
  return MONTH_LABELS.map((label, i) => ({ key: String(i), label }));
}

/* ------------------------------------------------------------------ */
/*  Goal proration                                                     */
/* ------------------------------------------------------------------ */

/**
 * Prorate an annual goal to the selected time range.
 * Returns the full goal for the current year, prorated for month,
 * or null for past years.
 */
export function prorateGoal(
  annualGoal: number,
  range: GarminTimeRange,
  today: Date = new Date(),
): number | null {
  const year = parseYearRange(range);
  if (year !== null) {
    // Current year → full goal; past years → no goal
    return year === today.getFullYear() ? annualGoal : null;
  }

  // 'month': prorate by days
  const start = getRangeStart(range, today);
  const end = getRangeEnd(range, today);
  const rangeDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) + 1;

  const yearStart = new Date(today.getFullYear(), 0, 1);
  const yearEnd = new Date(today.getFullYear(), 11, 31);
  const yearDays = (yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24) + 1;

  return annualGoal * (rangeDays / yearDays);
}

/* ------------------------------------------------------------------ */
/*  Main chart data builder                                            */
/* ------------------------------------------------------------------ */

/**
 * Build chart data for a single metric from filtered activities.
 *
 * @param activities - Already filtered by date range and activity type
 * @param metric - Which metric to aggregate
 * @param range - Time range (determines bucket granularity)
 * @param goal - Annual goal value in display units, or null
 * @param today - Reference date for range calculations
 */
export function buildMetricChartData(
  activities: GarminActivity[],
  metric: GarminMetric,
  range: GarminTimeRange,
  goal: number | null,
  today: Date = new Date(),
): MetricChartData {
  // Check if any activity has data for this metric
  const hasData = activities.some((a) => {
    const raw = a[metric];
    return typeof raw === 'number' && raw > 0;
  });

  if (!hasData) {
    return {
      metric,
      buckets: [],
      cumulative: [],
      proratedGoal: null,
      unit: METRIC_UNITS[metric],
      total: 0,
    };
  }

  const slots = generateBucketSlots(range, today);

  // Aggregate into buckets
  const bucketMap = new Map<string, number>();
  for (const { key } of slots) {
    bucketMap.set(key, 0);
  }

  for (const activity of activities) {
    const raw = activity[metric];
    if (typeof raw !== 'number' || raw <= 0) continue;
    const displayVal = toDisplayUnit(metric, raw);
    const key = getBucketKey(activity.date, range);
    bucketMap.set(key, (bucketMap.get(key) ?? 0) + displayVal);
  }

  const buckets: ChartBucket[] = slots.map(({ key, label }) => ({
    label,
    value: bucketMap.get(key) ?? 0,
  }));

  // Cumulative
  const cumulative: number[] = [];
  let running = 0;
  for (const b of buckets) {
    running += b.value;
    cumulative.push(running);
  }

  const proratedGoal = goal !== null ? prorateGoal(goal, range, today) : null;

  return {
    metric,
    buckets,
    cumulative,
    proratedGoal,
    unit: METRIC_UNITS[metric],
    total: running,
  };
}

/* ------------------------------------------------------------------ */
/*  Value formatting                                                   */
/* ------------------------------------------------------------------ */

/** Format a display-unit value for axis labels. */
export function formatMetricValue(v: number, metric: GarminMetric): string {
  if (metric === 'duration') {
    if (v >= 100) return `${Math.round(v)}`;
    if (v >= 10) return v.toFixed(1);
    return v.toFixed(2);
  }
  if (metric === 'elevationGain') {
    if (v >= 10000) return `${(v / 1000).toFixed(0)}k`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return Math.round(v).toString();
  }
  // distance
  if (v >= 100) return Math.round(v).toString();
  if (v >= 10) return v.toFixed(1);
  return v.toFixed(2);
}
