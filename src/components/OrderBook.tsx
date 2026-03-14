import React from 'react';
import './OrderBook.css';

interface Level {
  price: number;
  size: number;
  cumulative: number;
}

interface Props {
  groupedBids: Level[];
  groupedAsks: Level[];
  midPrice?: number;
  spread?: number;
  spreadBps?: number;
  imbalance?: number;
  group: number;
  onGroupChange: (g: number) => void;
  groupOptions: number[];
  flashBids: Record<number, 'up' | 'down'>;
  flashAsks: Record<number, 'up' | 'down'>;
}

const OrderBook: React.FC<Props> = React.memo(({
  groupedBids,
  groupedAsks,
  midPrice,
  spread,
  spreadBps,
  imbalance,
  group,
  onGroupChange,
  groupOptions,
  flashBids,
  flashAsks,
}) => {
  // Optimization: The last element in a cumulative array holds the total/max value. O(1) access.
  const maxBidCum = React.useMemo(() => groupedBids.length ? groupedBids[groupedBids.length - 1].cumulative : 0, [groupedBids]);
  const maxAskCum = React.useMemo(() => groupedAsks.length ? groupedAsks[groupedAsks.length - 1].cumulative : 0, [groupedAsks]);
  const totalBid = maxBidCum;
  const totalAsk = maxAskCum;
  const VISIBLE_ROWS = 25;

  return (
    <div className="orderbook-container">
      <div className="orderbook-header">
        <span className="live-badge">LIVE</span>
        <label>
          Group:
          <select value={group} onChange={(e) => onGroupChange(Number(e.target.value))}>
            {groupOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <div className="totals">
          <span>Total bids: {totalBid.toFixed(4)}</span>
          <span>Total asks: {totalAsk.toFixed(4)}</span>
        </div>
        {midPrice !== undefined && (
          <div className="stats">
            <span>Mid: {midPrice.toFixed(4)}</span>
            <span>Spread: {spread?.toFixed(4)} ({spreadBps?.toFixed(1)} bps)</span>
            <span>Imbalance: {imbalance?.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="orderbook-asks">
        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Price</th>
              <th style={{ textAlign: 'right' }}>Size</th>
              <th style={{ textAlign: 'right' }}>Cum.</th>
            </tr>
          </thead>
          <tbody>
            {groupedAsks.length === 0 ? (
              <tr><td colSpan={3} style={{ textAlign: 'center', opacity: 0.5 }}>Loading...</td></tr>
            ) : (
              groupedAsks.slice(0, VISIBLE_ROWS).map((a) => {
                const pct = maxAskCum ? (a.cumulative / maxAskCum) * 100 : 0;
                return (
                  <tr
                    key={a.price}
                    className={`ask-row ${flashAsks[a.price] === 'up' ? 'flash-up' : ''} ${
                      flashAsks[a.price] === 'down' ? 'flash-down' : ''
                    }`}
                    style={{ '--bar-width': `${pct}%` } as any}
                  >
                    <td style={{ textAlign: 'left' }}>{a.price.toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>{a.size.toFixed(4)}</td>
                    <td style={{ textAlign: 'right' }}>{a.cumulative.toFixed(4)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="orderbook-bids">
        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Price</th>
              <th style={{ textAlign: 'right' }}>Size</th>
              <th style={{ textAlign: 'right' }}>Cum.</th>
            </tr>
          </thead>
          <tbody>
            {groupedBids.length === 0 ? (
              <tr><td colSpan={3} style={{ textAlign: 'center', opacity: 0.5 }}>Loading...</td></tr>
            ) : (
              groupedBids.slice(0, VISIBLE_ROWS).map((b) => {
                const pct = maxBidCum ? (b.cumulative / maxBidCum) * 100 : 0;
                return (
                  <tr
                    key={b.price}
                    className={`bid-row ${flashBids[b.price] === 'up' ? 'flash-up' : ''} ${
                      flashBids[b.price] === 'down' ? 'flash-down' : ''
                    }`}
                    style={{ '--bar-width': `${pct}%` } as any}
                  >
                    <td style={{ textAlign: 'left' }}>{b.price.toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>{b.size.toFixed(4)}</td>
                    <td style={{ textAlign: 'right' }}>{b.cumulative.toFixed(4)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default OrderBook;
