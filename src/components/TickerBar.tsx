import React from 'react';
import './TickerBar.css';

interface Ticker {
  symbol: string;
  last: number;
  change24h: number;
}

interface Props {
  tickers: Ticker[];
  focused: string;
  onSelect: (symbol: string) => void;
}

const TickerBar: React.FC<Props> = React.memo(({ tickers, focused, onSelect }) => {
  console.log('tickers-----', tickers);
  return (
    <div className="ticker-bar">
      {tickers.length === 0 ? (
        <span className="loading">loading tickers…</span>
      ) : (
        tickers.map((t) => (
          <div
            key={t.symbol}
            className={`ticker-item ${focused === t.symbol ? 'focused' : ''}`}
            onClick={() => {
              onSelect(t.symbol);
            }}
          >
            <span className="symbol">{t.symbol}</span>
            <span className="last">{t.last.toFixed(2)}</span>
            <span className={`change ${t.change24h >= 0 ? 'positive' : 'negative'}`}> 
              {t.change24h.toFixed(2)}%
            </span>
          </div>
        ))
      )}
    </div>
  );
});

export default TickerBar;
