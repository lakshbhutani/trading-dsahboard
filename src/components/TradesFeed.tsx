import './TradesFeed.css';

import React, { useEffect, useRef, useState } from 'react';
import './TradesFeed.css';

interface AggTrade {
  time: string;
  price: number;
  size: number;
  side: 'buy' | 'sell';
  count: number;
  notional?: number;
}

interface RollingStats {
  buyVolume: number;
  sellVolume: number;
  count: number;
  avgSize: number;
}

interface Props {
  trades: AggTrade[];
  stats: RollingStats;
  largeThreshold: number;
  onThresholdChange: (n: number) => void;
}

const TradesFeed: React.FC<Props> = React.memo(({ trades, stats, largeThreshold, onThresholdChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // auto-scroll effect
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [trades, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    // Use a small buffer (1px) because scrollTop can be fractional on high-DPI screens
    if (Math.abs(scrollHeight - scrollTop - clientHeight) < 2) {
      setAutoScroll(true);
    } else {
      setAutoScroll(false);
    }
  };

  const renderedRows = React.useMemo(() => {
    if (trades.length === 0) return <tr><td colSpan={3} style={{ textAlign: 'center', opacity: 0.5 }}>Loading trades...</td></tr>;
    return trades.map((t, idx) => {
      // Use pre-calculated notional if available, otherwise compute it
      const notional = t.notional ?? (t.price * t.size);
      return (
        <tr
          key={idx}
          className={`${t.side === 'buy' ? 'buy' : 'sell'} ${notional >= largeThreshold ? 'large' : ''}`}
        >
          <td style={{ textAlign: 'left' }}>{t.time}</td>
          <td style={{ textAlign: 'right' }}>{t.price.toFixed(2)}</td>
          <td style={{ textAlign: 'right' }}>{t.size.toFixed(4)}{t.count > 1 ? ` (${t.count})` : ''}</td>
        </tr>
      );
    });
  }, [trades, largeThreshold]);

  return (
    <div className="trades-feed">
      <div className="trades-controls">
        <label>
          Large trade &gt;=
          <input
            type="number"
            value={largeThreshold}
            onChange={(e) => onThresholdChange(Number(e.target.value))}
            style={{ width: '80px', marginLeft: '4px' }}
          />
        </label>
        <div className="rolling-stats">
          <span>Buy vol: {stats.buyVolume.toFixed(2)}</span>
          <span>Sell vol: {stats.sellVolume.toFixed(2)}</span>
          <span>Count: {stats.count}</span>
          <span>Avg size: {stats.avgSize.toFixed(2)}</span>
        </div>
      </div>
      <div ref={containerRef} className="trades-list" onScroll={handleScroll}>
        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Time</th>
              <th style={{ textAlign: 'right' }}>Price</th>
              <th style={{ textAlign: 'right' }}>Size</th>
            </tr>
          </thead>
          <tbody>
          {renderedRows}
      </tbody>
        </table>
      </div>
      {!autoScroll && (
        <button className="jump-btn" onClick={() => setAutoScroll(true)}>
          Jump to latest
        </button>
      )}
    </div>
  );
});

export default TradesFeed;
