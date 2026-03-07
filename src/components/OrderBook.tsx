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

const OrderBook: React.FC<Props> = ({
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
  return (
    <div className="orderbook-container">
      <div className="orderbook-header">
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
              groupedAsks.map((a, idx) => (
                <tr
                  key={idx}
                  className={`ask-row ${flashAsks[a.price] === 'up' ? 'flash-up' : ''} ${
                    flashAsks[a.price] === 'down' ? 'flash-down' : ''
                  }`}
                >
                  <td>{a.price.toFixed(2)}</td>
                  <td>{a.size.toFixed(4)}</td>
                  <td>{a.cumulative.toFixed(4)}</td>
                </tr>
              ))
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
              groupedBids.map((b, idx) => (
                <tr
                  key={idx}
                  className={`bid-row ${flashBids[b.price] === 'up' ? 'flash-up' : ''} ${
                    flashBids[b.price] === 'down' ? 'flash-down' : ''
                  }`}
                >
                  <td>{b.price.toFixed(2)}</td>
                  <td>{b.size.toFixed(4)}</td>
                  <td>{b.cumulative.toFixed(4)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrderBook;
