import { useState, useMemo, useEffect } from 'react';
import type { ParsedLogRow } from '../google/sheets.js';
import type { ProgressMetric, TimeRange } from '../model/progress.js';
import {
  getLiftsWithData,
  buildProgressData,
  filterDips,
} from '../model/progress.js';

interface Props {
  logRows: ParsedLogRow[];
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
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ProgressView({ logRows }: Props) {
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

          {/* Time range toggle */}
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
          </div>

          {/* Skip dips toggle */}
          <div className="progress-toggle-group">
            <button
              className={`progress-toggle${skipDips ? ' active' : ''}`}
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
}: {
  liftId: string;
  label: string;
  logRows: ParsedLogRow[];
  metric: ProgressMetric;
  range: TimeRange;
  skipDips: boolean;
}) {
  const data = useMemo(() => {
    const raw = buildProgressData(logRows, liftId, metric, range);
    return skipDips ? filterDips(raw) : raw;
  }, [logRows, liftId, metric, range, skipDips]);

  return (
    <div className="progress-big4-item">
      <h3 className="progress-big4-label">{label}</h3>
      {data.length === 0 ? (
        <p className="progress-empty">No data yet.</p>
      ) : (
        <ProgressChart data={data} metric={metric} />
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

  if (data.length === 0) {
    return <p className="progress-empty">No data for this selection.</p>;
  }
  return <ProgressChart data={data} metric={metric} />;
}

/* ------------------------------------------------------------------ */
/*  SVG Line Chart                                                     */
/* ------------------------------------------------------------------ */

function ProgressChart({
  data,
  metric,
}: {
  data: { date: string; value: number }[];
  metric: ProgressMetric;
}) {
  // We use a viewBox so the chart is responsive
  const viewBoxWidth = 400;
  const plotW = viewBoxWidth - CHART_PADDING.left - CHART_PADDING.right;
  const plotH = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const valRange = maxVal - minVal || 1; // avoid division by zero

  // Pad the y-axis by 5% on each side
  const yMin = minVal - valRange * 0.05;
  const yMax = maxVal + valRange * 0.05;
  const yRange = yMax - yMin;

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

  const yUnit = metric === 'volume' ? 'lbs·reps' : 'lbs';

  return (
    <div className="progress-chart-container">
      <svg
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
            r={data.length > 30 ? 2 : 3}
            className="progress-dot"
          />
        ))}
      </svg>
      <div className="progress-unit">{yUnit} · max {formatValue(maxVal)}</div>
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
