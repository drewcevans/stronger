import { useState, useMemo, useEffect, useRef } from 'react';
import type { ParsedLogRow } from '../google/sheets.js';
import type { LiftGoal } from '../google/sheets.js';
import type { ScheduleEntry } from '../model/types.js';
import { FLAG_SENTINEL } from '../model/index.js';
import type { ProgressMetric, TimeRange, ProgressDataPoint } from '../model/progress.js';
import {
  getLiftsWithData,
  buildProgressData,
  filterDips,
} from '../model/progress.js';
import { useChartTooltip } from '../hooks/useChartTooltip.js';
import { Target } from 'lucide-react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceDot,
} from 'recharts';

interface BodyStatRow {
  date: string;
  bodyWeight: number;
  bodyFat: number;
  subcutaneousFat: number;
  fatFreeMass: number;
}

interface Props {
  logRows: ParsedLogRow[];
  schedule?: ScheduleEntry[];
  liftGoals?: LiftGoal[];
  onLiftGoalChange?: (liftId: string, weight: number | null) => void;
  nutritionRows?: { date: string; co2ekg: number; calories: number }[];
  bodyStatRows?: BodyStatRow[];
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function MonthCalendar({ schedule, logRows }: { schedule?: ScheduleEntry[]; logRows: ParsedLogRow[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const startOffset = firstDow === 0 ? 6 : firstDow - 1; // shift to Mon=0

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const yy = String(year);
  const mm = String(month + 1).padStart(2, '0');
  const prefix = `${yy}-${mm}-`;

  const scheduledSet = useMemo(() => {
    const s = new Set<string>();
    if (schedule) {
      for (const e of schedule) {
        if (e.date.startsWith(prefix) && e.workoutId && e.workoutId !== FLAG_SENTINEL) {
          s.add(e.date);
        }
      }
    }
    return s;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, prefix]);

  const loggedSet = useMemo(() => {
    const s = new Set<string>();
    for (const r of logRows) {
      const logDate = String(r.date).split('T')[0];
      if (logDate.startsWith(prefix)) s.add(logDate);
    }
    return s;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logRows, prefix]);

  const todayNum = now.getDate();

  return (
    <div className="month-cal">
      <div className="month-cal-title">{MONTH_NAMES[month]} {year}</div>
      <div className="month-cal-grid">
        {DOW_LABELS.map((d) => <div key={d} className="month-cal-dow">{d}</div>)}
        {cells.map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} className="month-cal-cell" />;
          const dateStr = `${prefix}${String(day).padStart(2, '0')}`;
          const done = loggedSet.has(dateStr);
          const sched = scheduledSet.has(dateStr);
          const isToday = day === todayNum;
          let cls = 'month-cal-cell';
          if (done) cls += ' month-cal-cell--done';
          else if (sched) cls += ' month-cal-cell--sched';
          if (isToday) cls += ' month-cal-cell--today';
          return (
            <div key={dateStr} className={cls}>
              <span className="month-cal-num">{done ? '✓' : day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const METRIC_LABELS: Record<ProgressMetric, string> = {
  volume: 'Total Volume',
  heaviest: 'Heaviest Weight',
  e1rm: 'Est. 1RM',
};

const RANGE_LABELS: Record<TimeRange, string> = {
  '1m': '1M',
  '3m': '3M',
  '12m': '1Y',
  all: 'All',
};

/** The four main barbell lifts shown prominently at the top. */
const BIG_FOUR = ['squat', 'bench-press', 'deadlift', 'overhead-press'] as const;

/**
 * Compute the minimum data-point value across *all* time for a given lift+metric.
 * Used as a stable y-axis floor so charts don't jump when toggling filters,
 * while adapting to the user's actual strength level.
 */
function allTimeMinForLift(
  logRows: ParsedLogRow[],
  liftId: string,
  metric: ProgressMetric,
): number | undefined {
  const all = buildProgressData(logRows, liftId, metric, 'all');
  if (all.length === 0) return undefined;
  return Math.min(...all.map((p) => p.value));
}

const BIG_FOUR_LABELS: Record<string, string> = {
  squat: 'Squat',
  'bench-press': 'Bench Press',
  deadlift: 'Deadlift',
  'overhead-press': 'Overhead Press',
};

/* ------------------------------------------------------------------ */
/*  SVG chart constants                                                */
/* ------------------------------------------------------------------ */

const CHART_PADDING = { top: 20, right: 16, bottom: 40, left: 52 };
const CHART_HEIGHT = 260;

/* ------------------------------------------------------------------ */
/*  Body composition helpers                                           */
/* ------------------------------------------------------------------ */

function addDaysStr(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function calcBMR(weightLbs: number, heightFt: number, heightIn: number, age: number, sex: 'male' | 'female'): number {
  const kg = weightLbs / 2.205;
  const cm = (heightFt * 12 + heightIn) * 2.54;
  const base = 10 * kg + 6.25 * cm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

function lsNum(key: string, fallback: number): number {
  try { const v = parseFloat(localStorage.getItem(key) ?? ''); return isNaN(v) ? fallback : v; } catch { return fallback; }
}
function lsStr(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

function fmtDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[m - 1]} ${d}`;
}

type BodyMetric = 'bodyWeight' | 'bodyFat' | 'subcutaneousFat' | 'fatFreeMass';

const BODY_METRIC_LABELS: Record<BodyMetric, string> = {
  bodyWeight: 'Body Weight (lbs)',
  bodyFat: 'Body Fat %',
  subcutaneousFat: 'Subcutaneous Fat %',
  fatFreeMass: 'Fat Free Mass (lbs)',
};

const PROJ_DAYS = 28;

function BodyCompChart({
  bodyStatRows,
  nutritionRows,
}: {
  bodyStatRows: BodyStatRow[];
  nutritionRows: { date: string; calories?: number }[];
}) {
  const [metric, setMetric] = useState<BodyMetric>('bodyWeight');
  const [showDebug, setShowDebug] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTitleTap = () => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      setShowDebug((v) => !v);
    } else {
      tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 1500);
    }
  };

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const sortedStats = useMemo(
    () => [...bodyStatRows].sort((a, b) => a.date.localeCompare(b.date)),
    [bodyStatRows],
  );

  const { chartData, lastEntry, projLast, weeklyChange, hasAvgData, projDots, debugMeta } = useMemo(() => {
    const empty = { chartData: [], lastEntry: null, projLast: 0, weeklyChange: 0, hasAvgData: false, projDots: [] as { date: string; val: number }[], debugMeta: null };
    if (sortedStats.length === 0) return empty;

    const last = sortedStats[sortedStats.length - 1];

    // Profile from localStorage — apply fallbacks so projection works without profile setup
    const rawAge = lsNum('stronger_age', 0);
    const rawHeightFt = lsNum('stronger_height_ft', 0);
    const rawHeightIn = lsNum('stronger_height_in', 0);
    const sex: 'male' | 'female' = lsStr('stronger_sex', 'male') === 'female' ? 'female' : 'male';
    const actMult = lsNum('stronger_activity_level', 1.55);
    const lsPhase = lsStr('stronger_phase', '—');

    const age = rawAge > 0 ? rawAge : 35;
    const totalRawIn = rawHeightFt * 12 + rawHeightIn;
    const heightFt = totalRawIn > 0 ? rawHeightFt : 5;
    const heightIn = totalRawIn > 0 ? rawHeightIn : 10;
    const weightLbs = last.bodyWeight > 0 ? last.bodyWeight : 180;

    const bmr = calcBMR(weightLbs, heightFt, heightIn, age, sex);
    const rawTdee = bmr * actMult;
    const tdee = isFinite(rawTdee) && rawTdee >= 1200 ? rawTdee : 2400;

    console.log('[projection] TDEE inputs:', {
      age, heightIn: heightFt * 12 + heightIn, weightLbs, sex, activityMultiplier: actMult, bmr, tdee,
    });

    // Daily net cals: only include days BEFORE today with calories > 0
    const caloriesByDate = new Map<string, number>();
    for (const row of nutritionRows) {
      caloriesByDate.set(row.date, (caloriesByDate.get(row.date) ?? 0) + (row.calories ?? 0));
    }
    const netByDate = new Map<string, number>();
    for (const [date, consumed] of caloriesByDate) {
      if (consumed > 0 && date < todayStr) {
        const burned = lsNum(`stronger_cal_burned_${date}`, 0);
        netByDate.set(date, consumed - (isNaN(burned) ? 0 : burned));
      }
    }
    const netVals = [...netByDate.values()];
    const hasAvgData = netVals.length > 0;
    const avgNet = hasAvgData ? netVals.reduce((a, b) => a + b, 0) / netVals.length : 0;

    // State variables that evolve through trend then projection
    let tw = last.bodyWeight;
    let tbf = last.bodyFat;
    let tsf = last.subcutaneousFat;
    let tffm = last.fatFreeMass;
    const sfRatio = tbf > 0 ? tsf / tbf : 0;

    function applyCalBal(calBal: number) {
      const wChange = calBal / 3500;
      tw += wChange;
      if (tw > 0) {
        if (calBal < 0) {
          const fatMass = Math.max(0, (tbf / 100) * tw - Math.abs(calBal) / 3500);
          tbf = (fatMass / tw) * 100;
        } else {
          tbf = ((tbf / 100) * tw + wChange * 0.7) / tw * 100;
          tffm += wChange * 0.3;
        }
        tsf = tbf * sfRatio;
      }
    }

    function snap(): Record<BodyMetric, number> {
      return {
        bodyWeight: Math.round(tw * 10) / 10,
        bodyFat: Math.round(tbf * 10) / 10,
        subcutaneousFat: Math.round(tsf * 10) / 10,
        fatFreeMass: Math.round(tffm * 10) / 10,
      };
    }

    // Trend: last body stat entry → yesterday (inclusive)
    const trendMap = new Map<string, Record<BodyMetric, number>>();
    trendMap.set(last.date, snap());
    for (let i = 1; ; i++) {
      const date = addDaysStr(last.date, i);
      if (date >= todayStr) break;
      const net = netByDate.get(date) ?? (hasAvgData ? avgNet : 0);
      applyCalBal(net);
      trendMap.set(date, snap());
    }

    // Projection: today → today + 28 days (using avgNet each day)
    const projMap = new Map<string, Record<BodyMetric, number>>();
    projMap.set(todayStr, snap());
    for (let i = 1; i <= PROJ_DAYS; i++) {
      applyCalBal(avgNet);
      projMap.set(addDaysStr(todayStr, i), snap());
    }

    // Week-interval dots for projection line
    const projDots = [0, 7, 14, 21, 28]
      .map((off) => { const d = addDaysStr(todayStr, off); const p = projMap.get(d); return p ? { date: d, val: p[metric] } : null; })
      .filter((x): x is { date: string; val: number } => x !== null);

    // Merge all dates into one sorted series
    const allDates = new Set<string>();
    for (const e of sortedStats) allDates.add(e.date);
    for (const d of trendMap.keys()) allDates.add(d);
    for (const d of projMap.keys()) allDates.add(d);
    const allSorted = [...allDates].sort();

    const actualMap = new Map(sortedStats.map((e) => [e.date, e]));
    const data = allSorted.map((date) => ({
      date,
      ts: new Date(date).getTime(),
      actual: actualMap.has(date) ? actualMap.get(date)![metric] : undefined,
      trend: trendMap.has(date) ? trendMap.get(date)![metric] : undefined,
      projection: (hasAvgData && projMap.has(date)) ? projMap.get(date)![metric] : undefined,
    }));

    const todayVal = projMap.get(todayStr)?.[metric] ?? last[metric];
    const projValue = projMap.get(addDaysStr(todayStr, PROJ_DAYS))?.[metric] ?? todayVal;
    const weeklyChange = hasAvgData ? (projValue - todayVal) / 4 : 0;

    const meta = {
      rawAge, age, rawHeightFt, rawHeightIn, heightFt, heightIn,
      sex, actMult, lsPhase, weightLbs, bmr: Math.round(bmr), tdee: Math.round(tdee),
      avgNet: Math.round(avgNet), daysUsed: netVals.length, projWeight: projValue,
    };

    return { chartData: data, lastEntry: last, projLast: projValue, weeklyChange, hasAvgData, projDots, debugMeta: meta };
  }, [sortedStats, metric, nutritionRows, todayStr]);

  if (sortedStats.length === 0) {
    return (
      <div className="co2-chart-card">
        <h3 className="co2-chart-title" style={{ cursor: 'default', userSelect: 'none' }} onClick={handleTitleTap}>Body Composition Trend</h3>
        <p className="progress-empty">No body stats recorded yet.</p>
      </div>
    );
  }

  const unit = metric === 'bodyWeight' || metric === 'fatFreeMass' ? 'lbs' : '%';
  const isGain = weeklyChange > 0;

  return (
    <div className="co2-chart-card">
      <div className="body-chart-header">
        <h3 className="co2-chart-title" style={{ margin: 0, cursor: 'default', userSelect: 'none' }} onClick={handleTitleTap}>Body Composition Trend</h3>
        <select
          className="body-chart-select"
          value={metric}
          onChange={(e) => setMetric(e.target.value as BodyMetric)}
        >
          {(Object.entries(BODY_METRIC_LABELS) as [BodyMetric, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      {(() => {
        // Evenly-spaced ticks every 4 days across the full date range
        const xTicks: number[] = [];
        if (chartData.length > 0) {
          const start = new Date(chartData[0].date);
          const end = new Date(chartData[chartData.length - 1].date);
          const cur = new Date(start);
          while (cur <= end) {
            xTicks.push(cur.getTime());
            cur.setDate(cur.getDate() + 4);
          }
          // Always include the last date
          const endTs = end.getTime();
          if (xTicks[xTicks.length - 1] !== endTs) xTicks.push(endTs);
        }
        const todayTs = new Date(todayStr).getTime();
        const xTickFormatter = (val: number) => {
          const d = new Date(val);
          return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
        };
        return (
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData} margin={{ top: 40, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                ticks={xTicks}
                tickFormatter={xTickFormatter}
                tick={{ fill: '#888', fontSize: 10 }}
              />
              <YAxis tick={{ fill: '#888', fontSize: 10 }} width={48} unit={unit === '%' ? '%' : ''} />
              <Tooltip
                contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: '6px' }}
                labelStyle={{ color: '#888', fontSize: '0.75rem' }}
                labelFormatter={(val) => xTickFormatter(val as number)}
                formatter={(v) => [`${v} ${unit}`]}
              />
              {/* Actuals: real FitIndex measurements */}
              <Line type="monotone" dataKey="actual" stroke="#ff1493" strokeWidth={2}
                dot={{ fill: '#ff1493', r: 4 }} name="Actual" connectNulls={false} />
              {/* Historical trend: last entry → yesterday */}
              <Line type="monotone" dataKey="trend" stroke="#39ff14" strokeWidth={1.5}
                dot={false} name="Trend" connectNulls={false} />
              {/* Projection: today → +4 weeks — clean dashes, no dots */}
              {hasAvgData && (
                <Line type="monotone" dataKey="projection" stroke="#e8ff00" strokeWidth={1.5}
                  strokeDasharray="5 3" dot={false} activeDot={false} name="Projection" connectNulls={false} />
              )}
              {/* Today line rendered last so it draws on top of data lines */}
              <ReferenceLine x={todayTs} stroke="rgba(255,255,255,0.5)" strokeDasharray="3 3"
                label={(props: { viewBox?: { x?: number } }) => {
                  const x = props.viewBox?.x ?? 0;
                  return (
                    <text x={x} y={-8} fill="#fff" fontSize={11} textAnchor="middle">Today</text>
                  );
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        );
      })()}
      {!hasAvgData && (
        <p className="progress-empty" style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem' }}>
          Insufficient data for projection — log nutrition for previous days to enable the yellow forecast line.
        </p>
      )}
      <div className="co2-summary">
        <div className="co2-summary-row">
          <span>Current</span>
          <span>{lastEntry![metric]} {unit} as of {fmtDate(lastEntry!.date)}</span>
        </div>
        <div className="co2-summary-row">
          <span>Projected in 4 weeks</span>
          <span>{projLast} {unit}</span>
        </div>
        <div className="co2-summary-row">
          <span>Trend</span>
          <span>{isGain ? '↑ gaining' : '↓ losing'} {Math.abs(weeklyChange).toFixed(1)} {unit}/week</span>
        </div>
      </div>

      {showDebug && debugMeta && (
        <div className="body-debug-panel">
          <div className="body-debug-title">Debug — Projection Inputs</div>
          <div className="body-debug-row"><span>Age (raw / used)</span><span>{debugMeta.rawAge} / {debugMeta.age}</span></div>
          <div className="body-debug-row"><span>Height (raw / used)</span><span>{debugMeta.rawHeightFt}′{debugMeta.rawHeightIn}″ / {debugMeta.heightFt}′{debugMeta.heightIn}″</span></div>
          <div className="body-debug-row"><span>Sex</span><span>{debugMeta.sex}</span></div>
          <div className="body-debug-row"><span>Activity level</span><span>{debugMeta.actMult}</span></div>
          <div className="body-debug-row"><span>Phase</span><span>{debugMeta.lsPhase}</span></div>
          <div className="body-debug-row"><span>Weight used (lbs)</span><span>{debugMeta.weightLbs}</span></div>
          <div className="body-debug-row"><span>BMR</span><span>{debugMeta.bmr} kcal</span></div>
          <div className="body-debug-row"><span>TDEE</span><span>{debugMeta.tdee} kcal</span></div>
          <div className="body-debug-row"><span>Avg daily net cals</span><span>{debugMeta.avgNet} kcal ({debugMeta.daysUsed} days)</span></div>
          <div className="body-debug-row"><span>Projected weight (4wk)</span><span>{debugMeta.projWeight} lbs</span></div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CO2e footprint chart                                               */
/* ------------------------------------------------------------------ */

const CO2_ANNUAL_LOW = 750;
const CO2_ANNUAL_HIGH = 1000;
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function Co2Chart({ nutritionRows }: { nutritionRows: { date: string; co2ekg: number; calories?: number }[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const currentMonth = now.getMonth();
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.ceil((now.getTime() - startOfYear.getTime()) / 86400000) + 1;
  const daysInYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365;

  const yearRows = nutritionRows.filter((r) => r.date.startsWith(String(year)));

  const monthlyAdj = new Array(12).fill(0) as number[];
  for (const row of yearRows) {
    const m = parseInt(row.date.substring(5, 7), 10) - 1;
    if (m >= 0 && m < 12) monthlyAdj[m] += row.co2ekg * 1.2;
  }

  let cum = 0;
  const cumulativeByMonth = monthlyAdj.map((v) => { cum += v; return cum; });

  const ytdTotal = cumulativeByMonth[currentMonth];
  const projected = dayOfYear > 0 ? (ytdTotal / dayOfYear) * daysInYear : 0;
  const daysLeft = daysInYear - dayOfYear;
  const remaining1t = Math.max(0, CO2_ANNUAL_HIGH - ytdTotal);

  let status: string;
  let statusColor: string;
  if (projected < CO2_ANNUAL_LOW) {
    status = 'On Track 🌱'; statusColor = '#39ff14';
  } else if (projected <= CO2_ANNUAL_HIGH) {
    status = 'Watch It ⚠️'; statusColor = '#e8ff00';
  } else {
    status = 'Over Budget 🔴'; statusColor = '#ff4444';
  }

  const chartData = MONTHS_SHORT.map((month, i) => {
    const frac = (i + 1) / 12;
    return {
      month,
      actual: i <= currentMonth ? +cumulativeByMonth[i].toFixed(1) : undefined,
      targetLow: +(CO2_ANNUAL_LOW * frac).toFixed(1),
      targetZone: +((CO2_ANNUAL_HIGH - CO2_ANNUAL_LOW) * frac).toFixed(1),
      targetHigh: +(CO2_ANNUAL_HIGH * frac).toFixed(1),
    };
  });

  if (yearRows.length === 0) {
    return (
      <div className="co2-chart-card">
        <h3 className="co2-chart-title">CO₂e Footprint</h3>
        <p className="progress-empty">No nutrition CO₂e data logged yet.</p>
      </div>
    );
  }

  return (
    <div className="co2-chart-card">
      <h3 className="co2-chart-title">CO₂e Footprint</h3>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="month" tick={{ fill: '#888', fontSize: 10 }} />
          <YAxis unit=" kg" tick={{ fill: '#888', fontSize: 10 }} width={56} />
          <Tooltip
            contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: '6px' }}
            labelStyle={{ color: '#e8ff00', fontWeight: 600 }}
            formatter={(v) => [`${v} kg`]}
          />
          <Legend wrapperStyle={{ fontSize: '0.7rem', paddingTop: '0.5rem' }} />
          <Area stackId="zone" type="monotone" dataKey="targetLow"
            fill="transparent" stroke="none" legendType="none" />
          <Area stackId="zone" type="monotone" dataKey="targetZone"
            fill="rgba(232,255,0,0.1)" stroke="none" name="Target zone (0.75–1t/yr)" />
          <Line type="monotone" dataKey="targetLow" stroke="#e8ff00" strokeWidth={1}
            strokeDasharray="5 3" dot={false} name="0.75t/yr" />
          <Line type="monotone" dataKey="targetHigh" stroke="#e8ff00" strokeWidth={1}
            strokeDasharray="5 3" dot={false} name="1t/yr" />
          <Line type="monotone" dataKey="actual" stroke="#39ff14" strokeWidth={2.5}
            dot={false} name="Actual" connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="co2-summary">
        <div className="co2-summary-row">
          <span>YTD total (×1.2 adj.)</span>
          <span>{ytdTotal.toFixed(1)} kg</span>
        </div>
        <div className="co2-summary-row">
          <span>Projected annual</span>
          <span>{projected.toFixed(0)} kg</span>
        </div>
        <div className="co2-summary-row">
          <span>Status</span>
          <span style={{ color: statusColor }}>{status}</span>
        </div>
        <div className="co2-summary-row">
          <span>Budget to stay under 1t</span>
          <span>{ytdTotal >= CO2_ANNUAL_HIGH ? 'Over budget' : `${remaining1t.toFixed(1)} kg over ${daysLeft} days`}</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ProgressView({ logRows, schedule, liftGoals, onLiftGoalChange, nutritionRows = [], bodyStatRows = [] }: Props) {
  const lifts = useMemo(() => getLiftsWithData(logRows), [logRows]);

  // Separate big-4 lifts (that have data) from the rest
  const big4Set = new Set<string>(BIG_FOUR);
  const big4Lifts = BIG_FOUR.filter((id) => lifts.some((l) => l.liftId === id));
  const otherLifts = lifts.filter((l) => !big4Set.has(l.liftId));

  const [selectedLift, setSelectedLift] = useState<string>(otherLifts[0]?.liftId ?? '');
  const [metric, setMetric] = useState<ProgressMetric>('e1rm');
  const [range, setRange] = useState<TimeRange>('12m');
  const [skipDips, setSkipDips] = useState(true);

  // Auto-select the first "other" lift if the current selection becomes invalid
  useEffect(() => {
    if (otherLifts.length > 0 && !otherLifts.some((l) => l.liftId === selectedLift)) {
      setSelectedLift(otherLifts[0].liftId);
    }
  }, [otherLifts, selectedLift]);

  return (
    <div className="progress-view">
      <MonthCalendar schedule={schedule} logRows={logRows} />
      <h2 className="progress-title">Progress</h2>

      {lifts.length === 0 ? (
        <p className="progress-empty">No logged strength data yet. Complete a workout to see progress charts.</p>
      ) : (
        <>
          {/* Metric toggle */}
          <div className="progress-toggle-group">
            {(Object.keys(METRIC_LABELS) as ProgressMetric[]).map((m) => (
              <button
                key={m}
                className={`progress-toggle${metric === m ? ' active' : ''}`}
                onClick={() => setMetric(m)}
              >
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>

          {/* Time range + skip-dips toggle */}
          <div className="progress-toggle-group">
            {(Object.keys(RANGE_LABELS) as TimeRange[]).map((r) => (
              <button
                key={r}
                className={`progress-toggle${range === r ? ' active' : ''}`}
                onClick={() => setRange(r)}
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
            <button
              className={`progress-toggle progress-toggle-sm${skipDips ? ' active' : ''}`}
              onClick={() => setSkipDips((v) => !v)}
            >
              Skip Dips
            </button>
          </div>

          {/* Big 4 charts */}
          {big4Lifts.length > 0 && (
            <div className="progress-big4">
              {big4Lifts.map((liftId) => (
                <Big4Chart
                  key={liftId}
                  liftId={liftId}
                  label={BIG_FOUR_LABELS[liftId] ?? liftId}
                  logRows={logRows}
                  metric={metric}
                  range={range}
                  skipDips={skipDips}
                  goalWeight={liftGoals?.find((g) => g.liftId === liftId)?.weight}
                  onGoalChange={onLiftGoalChange}
                />
              ))}
            </div>
          )}

          {/* Remaining exercises dropdown */}
          {otherLifts.length > 0 && (
            <>
              <div className="progress-controls">
                <select
                  className="progress-select"
                  value={selectedLift}
                  onChange={(e) => setSelectedLift(e.target.value)}
                >
                  {otherLifts.map((l) => (
                    <option key={l.liftId} value={l.liftId}>
                      {l.exerciseName}
                    </option>
                  ))}
                </select>
              </div>

              <SelectedLiftChart
                liftId={selectedLift}
                logRows={logRows}
                metric={metric}
                range={range}
                skipDips={skipDips}
              />
            </>
          )}
        </>
      )}
      <BodyCompChart bodyStatRows={bodyStatRows} nutritionRows={nutritionRows} />
      <Co2Chart nutritionRows={nutritionRows} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Big-4 lift chart wrapper                                           */
/* ------------------------------------------------------------------ */

function Big4Chart({
  liftId,
  label,
  logRows,
  metric,
  range,
  skipDips,
  goalWeight,
  onGoalChange,
}: {
  liftId: string;
  label: string;
  logRows: ParsedLogRow[];
  metric: ProgressMetric;
  range: TimeRange;
  skipDips: boolean;
  goalWeight?: number;
  onGoalChange?: (liftId: string, weight: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  const data = useMemo(() => {
    const raw = buildProgressData(logRows, liftId, metric, range);
    return skipDips ? filterDips(raw) : raw;
  }, [logRows, liftId, metric, range, skipDips]);

  const stableYMin = useMemo(
    () => allTimeMinForLift(logRows, liftId, metric),
    [logRows, liftId, metric],
  );

  // Only show goal on heaviest and e1rm charts
  const showGoal = goalWeight !== undefined && metric !== 'volume';

  return (
    <div className="progress-big4-item">
      <div className="progress-big4-header">
        <h3 className="progress-big4-label">{label}</h3>
        {onGoalChange && metric !== 'volume' && (
          <button
            className="progress-goal-btn"
            onClick={() => {
              setGoalInput(goalWeight !== undefined ? String(goalWeight) : '');
              setEditing(!editing);
            }}
            title="Set 1RM goal"
          >
            <Target size={14} />
          </button>
        )}
      </div>
      {editing && onGoalChange && (
        <div className="progress-goal-input-row">
          <input
            className="progress-goal-input"
            type="number"
            placeholder="Goal weight"
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
          />
          <button
            className="progress-goal-save"
            onClick={() => {
              const v = Number(goalInput);
              onGoalChange(liftId, isFinite(v) && v > 0 ? v : null);
              setEditing(false);
            }}
          >
            Set
          </button>
        </div>
      )}
      {data.length === 0 ? (
        <p className="progress-empty">No data yet.</p>
      ) : (
        <ProgressChart data={data} metric={metric} stableYMin={stableYMin} goalWeight={showGoal ? goalWeight : undefined} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Selected-lift chart wrapper                                        */
/* ------------------------------------------------------------------ */

function SelectedLiftChart({
  liftId,
  logRows,
  metric,
  range,
  skipDips,
}: {
  liftId: string;
  logRows: ParsedLogRow[];
  metric: ProgressMetric;
  range: TimeRange;
  skipDips: boolean;
}) {
  const data = useMemo(() => {
    if (!liftId) return [];
    const raw = buildProgressData(logRows, liftId, metric, range);
    return skipDips ? filterDips(raw) : raw;
  }, [logRows, liftId, metric, range, skipDips]);

  const stableYMin = useMemo(
    () => liftId ? allTimeMinForLift(logRows, liftId, metric) : undefined,
    [logRows, liftId, metric],
  );

  if (data.length === 0) {
    return <p className="progress-empty">No data for this selection.</p>;
  }
  return <ProgressChart data={data} metric={metric} stableYMin={stableYMin} />;
}

/* ------------------------------------------------------------------ */
/*  SVG Line Chart                                                     */
/* ------------------------------------------------------------------ */

function ProgressChart({
  data,
  metric,
  stableYMin,
  goalWeight,
}: {
  data: ProgressDataPoint[];
  metric: ProgressMetric;
  stableYMin?: number;
  goalWeight?: number;
}) {
  // We use a viewBox so the chart is responsive
  const viewBoxWidth = 400;
  const plotW = viewBoxWidth - CHART_PADDING.left - CHART_PADDING.right;
  const plotH = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  const values = data.map((d) => d.value);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  // Use the all-time minimum for this lift+metric as a stable floor so the
  // y-axis doesn't jump when toggling time-range or skip-dips filters.
  // Fall back to the visible data minimum if no stable floor is provided.
  const yMin = stableYMin !== undefined ? Math.min(stableYMin, minVal) : minVal;
  // Extend yMax to include the goal weight so the goal line is always visible
  const effectiveMax = goalWeight !== undefined ? Math.max(maxVal, goalWeight) : maxVal;
  const yMax = Math.ceil(effectiveMax / 10) * 10 || 10;
  const yRange = yMax - yMin || 1;

  const xScale = (i: number) =>
    CHART_PADDING.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const yScale = (v: number) =>
    CHART_PADDING.top + plotH - ((v - yMin) / yRange) * plotH;

  // Build polyline points
  const points = data.map((d, i) => `${xScale(i)},${yScale(d.value)}`).join(' ');

  // Y-axis ticks (4–5 nice ticks)
  const yTicks = niceTicksFor(yMin, yMax, 5);

  // X-axis: show a few evenly spaced date labels
  const xLabelCount = Math.min(data.length, 5);
  const xLabelIndices: number[] = [];
  if (data.length <= xLabelCount) {
    for (let i = 0; i < data.length; i++) xLabelIndices.push(i);
  } else {
    for (let i = 0; i < xLabelCount; i++) {
      xLabelIndices.push(Math.round((i / (xLabelCount - 1)) * (data.length - 1)));
    }
  }

  const yUnit = metric === 'volume' ? 'vol' : '';

  // Tooltip support
  const xPositions = useMemo(
    () => data.map((_, i) => xScale(i)),
    // xScale depends on data.length and plotW (which is constant), so
    // data.length is sufficient as a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.length, plotW],
  );
  const { activeIndex, svgRef, containerHandlers } = useChartTooltip(xPositions, viewBoxWidth);
  const active = activeIndex !== null ? data[activeIndex] : null;

  return (
    <div className="progress-chart-container" {...containerHandlers}>
      <svg
        ref={svgRef}
        className="progress-chart"
        viewBox={`0 0 ${viewBoxWidth} ${CHART_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {yTicks.map((tick) => (
          <line
            key={tick}
            x1={CHART_PADDING.left}
            y1={yScale(tick)}
            x2={viewBoxWidth - CHART_PADDING.right}
            y2={yScale(tick)}
            className="progress-grid-line"
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((tick) => (
          <text
            key={tick}
            x={CHART_PADDING.left - 6}
            y={yScale(tick)}
            className="progress-axis-label"
            textAnchor="end"
            dominantBaseline="middle"
          >
            {formatValue(tick)}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabelIndices.map((i) => (
          <text
            key={i}
            x={xScale(i)}
            y={CHART_HEIGHT - 6}
            className="progress-axis-label"
            textAnchor="middle"
          >
            {formatDate(data[i].date)}
          </text>
        ))}

        {/* Area fill under line */}
        <polygon
          points={`${xScale(0)},${yScale(yMin)} ${points} ${xScale(data.length - 1)},${yScale(yMin)}`}
          className="progress-area"
        />

        {/* Line */}
        <polyline points={points} className="progress-line" />

        {/* Data points */}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={xScale(i)}
            cy={yScale(d.value)}
            r={i === activeIndex ? (data.length > 30 ? 3.5 : 5) : (data.length > 30 ? 2 : 3)}
            className={`progress-dot${i === activeIndex ? ' active' : ''}`}
          />
        ))}

        {/* Goal line (horizontal dashed) */}
        {goalWeight !== undefined && (
          <line
            x1={CHART_PADDING.left}
            y1={yScale(goalWeight)}
            x2={viewBoxWidth - CHART_PADDING.right}
            y2={yScale(goalWeight)}
            className="progress-goal-line"
          />
        )}

        {/* Tooltip crosshair */}
        {active != null && activeIndex !== null && (
          <line
            x1={xScale(activeIndex)}
            y1={CHART_PADDING.top}
            x2={xScale(activeIndex)}
            y2={CHART_PADDING.top + plotH}
            className="chart-crosshair"
          />
        )}
      </svg>
      <div className="progress-unit">
        {yUnit ? `${yUnit} · ` : ''}{formatValue(maxVal)}{goalWeight !== undefined ? ` / ${formatValue(goalWeight)}` : ''}
      </div>

      {/* Tooltip label */}
      {active != null && activeIndex !== null && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(xScale(activeIndex) / viewBoxWidth) * 100}%`,
          }}
        >
          <span className="chart-tooltip-value">{active.label || formatValue(active.value)}</span>
          <span className="chart-tooltip-date">{formatDate(active.date)}</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  const parts = iso.split('-');
  if (parts.length < 3) return iso;
  const year = parts[0].slice(2); // 2-digit year
  return `${parseInt(parts[1])}/${parseInt(parts[2])}/${year}`;
}

function formatValue(v: number): string {
  if (v >= 10000) return `${(v / 1000).toFixed(0)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

/**
 * Compute "nice" tick values for a y-axis given min/max and desired count.
 */
function niceTicksFor(min: number, max: number, count: number): number[] {
  const range = max - min;
  if (range === 0) return [min];

  const rawStep = range / (count - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;

  let niceStep: number;
  if (residual <= 1.5) niceStep = magnitude;
  else if (residual <= 3.5) niceStep = 2.5 * magnitude;
  else if (residual <= 7.5) niceStep = 5 * magnitude;
  else niceStep = 10 * magnitude;

  const niceMin = Math.floor(min / niceStep) * niceStep;
  const niceMax = Math.ceil(max / niceStep) * niceStep;

  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + niceStep * 0.01; v += niceStep) {
    ticks.push(Math.round(v * 1e6) / 1e6); // clean floating point
  }
  return ticks;
}
