import { describe, it, expect } from 'vitest';
import {
  toDisplayUnit,
  getRangeStart,
  getRangeEnd,
  getActivityTypes,
  filterActivities,
  generateBucketSlots,
  prorateGoal,
  buildMetricChartData,
  formatMetricValue,
} from '../garmin.js';
import type { GarminActivity } from '../garmin.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeActivity(overrides: Partial<GarminActivity> = {}): GarminActivity {
  return {
    date: '2025-06-15',
    activityType: 'Run',
    duration: 3600,        // 1 hour
    distance: 10000,       // 10 km
    elevationGain: 100,    // 100 m
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  toDisplayUnit                                                      */
/* ------------------------------------------------------------------ */

describe('toDisplayUnit', () => {
  it('converts meters to miles', () => {
    expect(toDisplayUnit('distance', 1609.34)).toBeCloseTo(1.0, 1);
  });

  it('converts meters to feet', () => {
    expect(toDisplayUnit('elevationGain', 100)).toBeCloseTo(328.084, 1);
  });

  it('converts seconds to hours', () => {
    expect(toDisplayUnit('duration', 3600)).toBeCloseTo(1.0, 5);
  });
});

/* ------------------------------------------------------------------ */
/*  getRangeStart / getRangeEnd                                        */
/* ------------------------------------------------------------------ */

describe('getRangeStart', () => {
  it('returns Monday for week range', () => {
    // 2025-06-18 is a Wednesday
    const today = new Date(2025, 5, 18);
    const start = getRangeStart('week', today);
    expect(start.getDay()).toBe(1); // Monday
    expect(start.getDate()).toBe(16);
  });

  it('returns first of month for month range', () => {
    const today = new Date(2025, 5, 18);
    const start = getRangeStart('month', today);
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(5);
  });

  it('returns first of quarter for quarter range', () => {
    // June is Q2 → starts April
    const today = new Date(2025, 5, 18);
    const start = getRangeStart('quarter', today);
    expect(start.getMonth()).toBe(3); // April
    expect(start.getDate()).toBe(1);
  });

  it('returns Jan 1 for year range', () => {
    const today = new Date(2025, 5, 18);
    const start = getRangeStart('year', today);
    expect(start.getMonth()).toBe(0);
    expect(start.getDate()).toBe(1);
  });

  it('returns epoch for all range', () => {
    const start = getRangeStart('all');
    expect(start.getFullYear()).toBe(1970);
  });
});

describe('getRangeEnd', () => {
  it('returns Sunday for week range', () => {
    const today = new Date(2025, 5, 18);
    const end = getRangeEnd('week', today);
    expect(end.getDay()).toBe(0); // Sunday
    expect(end.getDate()).toBe(22);
  });

  it('returns last day of month for month range', () => {
    const today = new Date(2025, 5, 18); // June
    const end = getRangeEnd('month', today);
    expect(end.getDate()).toBe(30);
  });

  it('returns last day of quarter for quarter range', () => {
    const today = new Date(2025, 5, 18); // Q2 ends June 30
    const end = getRangeEnd('quarter', today);
    expect(end.getMonth()).toBe(5);
    expect(end.getDate()).toBe(30);
  });
});

/* ------------------------------------------------------------------ */
/*  getActivityTypes                                                   */
/* ------------------------------------------------------------------ */

describe('getActivityTypes', () => {
  it('returns sorted unique types', () => {
    const activities = [
      makeActivity({ activityType: 'Run' }),
      makeActivity({ activityType: 'Hike' }),
      makeActivity({ activityType: 'Run' }),
      makeActivity({ activityType: 'Ride' }),
    ];
    expect(getActivityTypes(activities)).toEqual(['Hike', 'Ride', 'Run']);
  });

  it('returns empty for no activities', () => {
    expect(getActivityTypes([])).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/*  filterActivities                                                   */
/* ------------------------------------------------------------------ */

describe('filterActivities', () => {
  it('filters by date range and activity type', () => {
    const today = new Date(2025, 5, 18);
    const activities = [
      makeActivity({ date: '2025-06-16', activityType: 'Run' }),
      makeActivity({ date: '2025-06-17', activityType: 'Hike' }),
      makeActivity({ date: '2025-01-01', activityType: 'Run' }), // out of range
    ];
    const result = filterActivities(activities, 'week', new Set(['Run']), today);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2025-06-16');
  });

  it('includes all types in selectedTypes', () => {
    const today = new Date(2025, 5, 18);
    const activities = [
      makeActivity({ date: '2025-06-16', activityType: 'Run' }),
      makeActivity({ date: '2025-06-17', activityType: 'Hike' }),
    ];
    const result = filterActivities(activities, 'week', new Set(['Run', 'Hike']), today);
    expect(result).toHaveLength(2);
  });
});

/* ------------------------------------------------------------------ */
/*  generateBucketSlots                                                */
/* ------------------------------------------------------------------ */

describe('generateBucketSlots', () => {
  it('generates 7 day slots for week', () => {
    const slots = generateBucketSlots('week');
    expect(slots).toHaveLength(7);
    expect(slots[0].label).toBe('Mon');
    expect(slots[6].label).toBe('Sun');
  });

  it('generates weekly slots for month', () => {
    const today = new Date(2025, 5, 15); // June 2025
    const slots = generateBucketSlots('month', today);
    expect(slots.length).toBeGreaterThanOrEqual(4);
    expect(slots.length).toBeLessThanOrEqual(6);
    expect(slots[0].label).toMatch(/^W\d+$/);
  });

  it('generates monthly slots for all', () => {
    const today = new Date(2025, 5, 15);
    const slots = generateBucketSlots('all', today);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].label).toMatch(/^[A-Z][a-z]+ '\d{2}$/);
  });
});

/* ------------------------------------------------------------------ */
/*  prorateGoal                                                        */
/* ------------------------------------------------------------------ */

describe('prorateGoal', () => {
  it('returns null for all range', () => {
    expect(prorateGoal(1000, 'all')).toBeNull();
  });

  it('prorates annual goal to a month', () => {
    const today = new Date(2025, 5, 15); // June, 30 days
    const result = prorateGoal(1000, 'month', today);
    // 30 days / 365 days * 1000 ≈ 82.19
    expect(result).toBeGreaterThan(70);
    expect(result).toBeLessThan(100);
  });

  it('prorates annual goal to a week', () => {
    const today = new Date(2025, 5, 15);
    const result = prorateGoal(1000, 'week', today);
    // 7 days / 365 days * 1000 ≈ 19.18
    expect(result).toBeGreaterThan(15);
    expect(result).toBeLessThan(25);
  });

  it('returns full goal for year range', () => {
    const today = new Date(2025, 5, 15);
    const result = prorateGoal(1000, 'year', today);
    // Year range spans all 365 days; small rounding from inclusive bounds
    expect(result!).toBeGreaterThan(990);
    expect(result!).toBeLessThan(1010);
  });
});

/* ------------------------------------------------------------------ */
/*  buildMetricChartData                                               */
/* ------------------------------------------------------------------ */

describe('buildMetricChartData', () => {
  it('returns empty buckets when no activities have data for metric', () => {
    const activities = [makeActivity({ distance: 0 })];
    const data = buildMetricChartData(activities, 'distance', 'week', null);
    expect(data.buckets).toHaveLength(0);
    expect(data.total).toBe(0);
  });

  it('aggregates distance into daily buckets for week view', () => {
    const today = new Date(2025, 5, 18); // Wednesday
    const activities = [
      makeActivity({ date: '2025-06-16', distance: 5000 }),  // Monday
      makeActivity({ date: '2025-06-16', distance: 3000 }),  // Monday (another)
      makeActivity({ date: '2025-06-18', distance: 10000 }), // Wednesday
    ];
    const data = buildMetricChartData(activities, 'distance', 'week', null, today);
    expect(data.buckets).toHaveLength(7);
    // Monday bucket should have sum of 5000 + 3000 = 8000m in miles
    expect(data.buckets[0].value).toBeCloseTo(toDisplayUnit('distance', 8000), 1);
    // Wednesday
    expect(data.buckets[2].value).toBeCloseTo(toDisplayUnit('distance', 10000), 1);
    // Other days = 0
    expect(data.buckets[1].value).toBe(0);
  });

  it('computes cumulative values', () => {
    const today = new Date(2025, 5, 18);
    const activities = [
      makeActivity({ date: '2025-06-16', distance: 5000 }),
      makeActivity({ date: '2025-06-18', distance: 10000 }),
    ];
    const data = buildMetricChartData(activities, 'distance', 'week', null, today);
    // Cumulative: [Mon, Tue, Wed, ...]
    expect(data.cumulative[0]).toBeCloseTo(toDisplayUnit('distance', 5000), 1);
    expect(data.cumulative[1]).toBeCloseTo(toDisplayUnit('distance', 5000), 1); // no change
    expect(data.cumulative[2]).toBeCloseTo(toDisplayUnit('distance', 15000), 1);
  });

  it('includes prorated goal when provided', () => {
    const today = new Date(2025, 5, 18);
    const activities = [makeActivity({ date: '2025-06-16', distance: 5000 })];
    const data = buildMetricChartData(activities, 'distance', 'week', 1000, today);
    expect(data.proratedGoal).not.toBeNull();
    expect(data.proratedGoal!).toBeGreaterThan(0);
  });

  it('handles duration metric', () => {
    const today = new Date(2025, 5, 18);
    const activities = [makeActivity({ date: '2025-06-16', duration: 7200 })]; // 2 hours
    const data = buildMetricChartData(activities, 'duration', 'week', null, today);
    expect(data.buckets[0].value).toBeCloseTo(2.0, 1);
    expect(data.unit).toBe('hours');
  });

  it('handles elevationGain metric', () => {
    const today = new Date(2025, 5, 18);
    const activities = [makeActivity({ date: '2025-06-16', elevationGain: 500 })]; // 500m
    const data = buildMetricChartData(activities, 'elevationGain', 'week', null, today);
    expect(data.buckets[0].value).toBeCloseTo(toDisplayUnit('elevationGain', 500), 0);
    expect(data.unit).toBe('feet');
  });
});

/* ------------------------------------------------------------------ */
/*  formatMetricValue                                                  */
/* ------------------------------------------------------------------ */

describe('formatMetricValue', () => {
  it('formats large elevation values with k suffix', () => {
    expect(formatMetricValue(15000, 'elevationGain')).toBe('15k');
    expect(formatMetricValue(1500, 'elevationGain')).toBe('1.5k');
  });

  it('formats small distance values with decimals', () => {
    expect(formatMetricValue(3.14, 'distance')).toBe('3.14');
    expect(formatMetricValue(12.5, 'distance')).toBe('12.5');
  });

  it('formats duration with appropriate precision', () => {
    expect(formatMetricValue(1.5, 'duration')).toBe('1.50');
    expect(formatMetricValue(25.3, 'duration')).toBe('25.3');
  });
});
