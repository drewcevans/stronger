import { useState, useCallback, useRef } from 'react';

/**
 * Hook that maps pointer (mouse or touch) events on a responsive SVG chart
 * to the nearest data-point index.  Returns the active index (or null) and
 * event-handler props to spread onto the SVG's **container** div.
 *
 * Because the SVG uses a viewBox the rendered pixel size differs from the
 * logical coordinate space.  We convert screen coordinates → viewBox X,
 * then snap to the closest data-point index using the caller-supplied
 * `xPositions` array (logical X of each point).
 */
export function useChartTooltip(
  /** Logical X position of each data point in viewBox coordinates. */
  xPositions: number[],
  viewBoxWidth: number,
) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const resolve = useCallback(
    (clientX: number) => {
      const svg = svgRef.current;
      if (!svg || xPositions.length === 0) return;

      const rect = svg.getBoundingClientRect();
      // Map screen X → viewBox X
      const vbX = ((clientX - rect.left) / rect.width) * viewBoxWidth;

      // Find nearest data point
      let best = 0;
      let bestDist = Math.abs(vbX - xPositions[0]);
      for (let i = 1; i < xPositions.length; i++) {
        const d = Math.abs(vbX - xPositions[i]);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      setActiveIndex(best);
    },
    [xPositions, viewBoxWidth],
  );

  const clear = useCallback(() => setActiveIndex(null), []);

  /* Mouse handlers (desktop) */
  const onMouseMove = useCallback(
    (e: React.MouseEvent) => resolve(e.clientX),
    [resolve],
  );
  const onMouseLeave = clear;

  /* Touch handlers (mobile) */
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // Don't prevent default — allow scroll if purely vertical.
      // We just track position.
      if (e.touches.length === 1) resolve(e.touches[0].clientX);
    },
    [resolve],
  );
  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) resolve(e.touches[0].clientX);
    },
    [resolve],
  );
  const onTouchEnd = clear;

  return {
    activeIndex,
    svgRef,
    containerHandlers: {
      onMouseMove,
      onMouseLeave,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
}
