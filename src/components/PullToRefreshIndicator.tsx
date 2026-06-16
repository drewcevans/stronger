import { Loader } from 'lucide-react';

interface Props {
  pullDistance: number;
  threshold: number;
  refreshing: boolean;
}

export function PullToRefreshIndicator({ pullDistance, threshold, refreshing }: Props) {
  if (!refreshing && pullDistance === 0) return null;

  const pct = refreshing ? 0 : Math.min(0, -100 + (pullDistance / threshold) * 100);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: '8px',
      background: 'rgba(0,0,0,0.8)',
      color: '#39ff14',
      fontSize: 12,
      fontFamily: 'monospace',
      transform: `translateY(${pct}%)`,
      transition: 'transform 0.2s ease',
    }}>
      {refreshing ? (
        <>
          <Loader size={14} className="spin" />
          <span>Refreshing...</span>
        </>
      ) : (
        <span>{pullDistance >= threshold ? '↑ Release to refresh' : '↓ Pull to refresh'}</span>
      )}
    </div>
  );
}
