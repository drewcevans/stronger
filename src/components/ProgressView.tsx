import { useState, useMemo } from 'react';
import type { ParsedLogRow } from '../google/sheets.js';
import type { ProgressMetric, TimeRange } from '../model/progress.js';
import {
  getLiftsWithData,
  buildProgressData,
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

  const [selectedLift, setSelectedLift] = useState<string>(lifts[0]?.liftId ?? '');
  const [metric, setMetric] = useState<ProgressMetric>('volume');
  const [range, setRange] = useState<TimeRange>('3m');

  const data = useMemo(
    () => (selectedLift ? buildProgressData(logRows, selectedLift, metric, range) : []),
    [logRows, selectedLift, metric, range],
  );

  // Auto-select the first lift if the current selection becomes invalid
  if (selectedLift && !lifts.some((l) => l.liftId === selectedLift) && lifts.length > 0) {
    setSelectedLift(lifts[0].liftId);
  }

  return (
    <div className="progress-view">
      <h2 className="progress-title">Progress</h2>

      {lifts.length === 0 ? (
        <p className="progress-empty">No logged strength data yet. Complete a workout to see progress charts.</p>
      ) : (
        <>
          {/* Lift selector */}
          <div className="progress-controls">
            <select
              className="progress-select"
              value={selectedLift}
              onChange={(e) => setSelectedLift(e.target.value)}
            >
              {lifts.map((l) => (
                <option key={l.liftId} value={l.liftId}>
                  {l.exerciseName}
                </option>
              ))}
            </select>
          </div>

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

          {/* Chart */}
          {data.length === 0 ? (
            <p className="progress-empty">No data for this selection.</p>
          ) : (
            <ProgressChart data={data} metric={metric} />
          )}
        </>
      )}
    </div>
  );
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

  const yUnit = metric === 'volume' ? 'kg·reps' : 'kg';

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
      <div className="progress-unit">{yUnit}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  const parts = iso.split('-');
  if (parts.length < 3) return iso;
  return `${parts[1]}/${parts[2]}`;
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
