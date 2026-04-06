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

export type GarminTimeRange = 'week' | 'month' | 'quarter' | 'year' | 'all';

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

/** Get the start date (inclusive) for a time range anchored to today. */
export function getRangeStart(range: GarminTimeRange, today: Date = new Date()): Date {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);

  switch (range) {
    case 'week': {
      // ISO week: Monday = 1
      const day = d.getDay();
      const diff = day === 0 ? 6 : day - 1; // days since Monday
      d.setDate(d.getDate() - diff);
      return d;
    }
    case 'month':
      d.setDate(1);
      return d;
    case 'quarter': {
      const qMonth = Math.floor(d.getMonth() / 3) * 3;
      d.setMonth(qMonth, 1);
      return d;
    }
    case 'year':
      d.setMonth(0, 1);
      return d;
    case 'all':
      return new Date(0); // epoch
  }
}

/** Get the end date (inclusive) for a time range anchored to today. */
export function getRangeEnd(range: GarminTimeRange, today: Date = new Date()): Date {
  const d = new Date(today);
  d.setHours(23, 59, 59, 999);

  switch (range) {
    case 'week': {
      const start = getRangeStart('week', today);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return end;
    }
    case 'month': {
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return end;
    }
    case 'quarter': {
      const qMonth = Math.floor(d.getMonth() / 3) * 3 + 2;
      const end = new Date(d.getFullYear(), qMonth + 1, 0);
      end.setHours(23, 59, 59, 999);
      return end;
    }
    case 'year': {
      const end = new Date(d.getFullYear(), 11, 31);
      end.setHours(23, 59, 59, 999);
      return end;
    }
    case 'all':
      return d;
  }
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

/** Day-of-week labels for weekly view */
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
 * - week: day index (0=Mon..6=Sun)
 * - month/quarter/year: ISO week number "W{n}"
 * - all: month "YYYY-MM"
 */
function getBucketKey(dateStr: string, range: GarminTimeRange): string {
  const d = new Date(dateStr + 'T00:00:00');
  switch (range) {
    case 'week': {
      const day = d.getDay();
      const idx = day === 0 ? 6 : day - 1;
      return String(idx);
    }
    case 'month':
    case 'quarter':
    case 'year':
      return `W${getISOWeek(d)}`;
    case 'all':
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}

/** Generate all expected bucket keys and labels for a time range. */
export function generateBucketSlots(
  range: GarminTimeRange,
  today: Date = new Date(),
): { key: string; label: string }[] {
  const start = getRangeStart(range, today);
  const end = getRangeEnd(range, today);

  switch (range) {
    case 'week':
      return DAY_LABELS.map((label, i) => ({ key: String(i), label }));

    case 'month':
    case 'quarter':
    case 'year': {
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

    case 'all': {
      const slots: { key: string; label: string }[] = [];
      const cursor = new Date(start);
      // If start is epoch, use the current year minus 1 as a reasonable start
      if (cursor.getFullYear() < 2000) {
        cursor.setFullYear(today.getFullYear() - 1);
        cursor.setMonth(0, 1);
      }
      while (cursor <= end) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
        const label = `${MONTH_LABELS[cursor.getMonth()]} '${String(cursor.getFullYear()).slice(2)}`;
        slots.push({ key, label });
        cursor.setMonth(cursor.getMonth() + 1);
      }
      return slots;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Goal proration                                                     */
/* ------------------------------------------------------------------ */

/**
 * Prorate an annual goal to the selected time range.
 * Returns null for 'all' (goals are not meaningful for unbounded ranges).
 */
export function prorateGoal(
  annualGoal: number,
  range: GarminTimeRange,
  today: Date = new Date(),
): number | null {
  if (range === 'all') return null;

  const start = getRangeStart(range, today);
  const end = getRangeEnd(range, today);
  const rangeDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) + 1;

  // Use actual days in the year for accuracy
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
