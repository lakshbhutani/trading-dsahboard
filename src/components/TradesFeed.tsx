import React from 'react';
import './TradesFeed.css';

interface Trade {
  time: string;
  price: number;
  size: number;
  side: 'buy' | 'sell';
  aggregatedCount?: number;
  large?: boolean;
}

interface Props {
  trades: Trade[];
}

const TradesFeed: React.FC<Props> = ({ trades }) => {
  return (
    <div className="trades-feed">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Price</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, idx) => (
            <tr key={idx} className={t.side === 'buy' ? 'buy' : 'sell'}>
              <td>{t.time}</td>
              <td>{t.price.toFixed(2)}</td>
              <td>
                {t.size}
                {t.aggregatedCount && t.aggregatedCount > 1 ? ` (${t.aggregatedCount})` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TradesFeed;
