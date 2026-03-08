import React from 'react';
import './OrderBook.css';

interface Level {
  price: number;
  size: number;
  cumulative: number;
}

interface Props {
  bids: Level[];
  asks: Level[];
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
  bids,
  asks,
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
  const maxBidCum = React.useMemo(() => groupedBids.reduce((m, l) => Math.max(m, l.cumulative), 0), [groupedBids]);
  const maxAskCum = React.useMemo(() => groupedAsks.reduce((m, l) => Math.max(m, l.cumulative), 0), [groupedAsks]);
  const totalBid = React.useMemo(() => groupedBids.reduce((s, l) => s + l.size, 0), [groupedBids]);
  const totalAsk = React.useMemo(() => groupedAsks.reduce((s, l) => s + l.size, 0), [groupedAsks]);
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
        <table>
          <thead>
            <tr>
              <th>Price</th>
              <th>Size</th>
              <th>Cum.</th>
            </tr>
          </thead>
          <tbody>
            {groupedAsks.length === 0 ? (
              <tr><td colSpan={3}>no data</td></tr>
            ) : (
              groupedAsks.map((a, idx) => {
                const pct = maxAskCum ? (a.cumulative / maxAskCum) * 100 : 0;
                return (
                  <tr
                    key={idx}
                    className={`ask-row ${flashAsks[a.price] === 'up' ? 'flash-up' : ''} ${
                      flashAsks[a.price] === 'down' ? 'flash-down' : ''
                    }`}
                    style={{ '--bar-width': `${pct}%` } as any}
                  >
                    <td>{a.price.toFixed(2)}</td>
                    <td>{a.size.toFixed(4)}</td>
                    <td>{a.cumulative.toFixed(4)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="orderbook-bids">
        <table>
          <thead>
            <tr>
              <th>Price</th>
              <th>Size</th>
              <th>Cum.</th>
            </tr>
          </thead>
          <tbody>
            {groupedBids.length === 0 ? (
              <tr><td colSpan={3}>no data</td></tr>
            ) : (
              groupedBids.map((b, idx) => {
                const pct = maxBidCum ? (b.cumulative / maxBidCum) * 100 : 0;
                return (
                  <tr
                    key={idx}
                    className={`bid-row ${flashBids[b.price] === 'up' ? 'flash-up' : ''} ${
                      flashBids[b.price] === 'down' ? 'flash-down' : ''
                    }`}
                    style={{ '--bar-width': `${pct}%` } as any}
                  >
                    <td>{b.price.toFixed(2)}</td>
                    <td>{b.size.toFixed(4)}</td>
                    <td>{b.cumulative.toFixed(4)}</td>
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
