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

// 1. Extract and Memoize TickerItem to prevent unnecessary re-renders
const TickerItem = React.memo(({ ticker, isFocused, onClick }: { ticker: Ticker; isFocused: boolean; onClick: (s: string) => void }) => {
  // 2. Verification: This log will show which specific symbols are re-rendering
  // console.log(`[TickerItem] render ${ticker.symbol}`);

  return (
    <div
      className={`ticker-item ${isFocused ? 'focused' : ''}`}
      onClick={() => onClick(ticker.symbol)}
    >
      <span className="symbol">{ticker.symbol}</span>
      <span className="last">{ticker.last.toFixed(2)}</span>
      <span className={`change ${ticker.change24h >= 0 ? 'positive' : 'negative'}`}>
        {ticker.change24h.toFixed(2)}%
      </span>
    </div>
  );
});

const TickerBar: React.FC<Props> = React.memo(({ tickers, focused, onSelect }) => {
  return (
    <div className="ticker-bar">
      {tickers.length === 0 ? (
        <span className="loading">loading tickers…</span>
      ) : (
        tickers.map((t) => (
          <TickerItem
            key={t.symbol}
            ticker={t}
            isFocused={focused === t.symbol}
            onClick={onSelect}
          />
        ))
      )}
    </div>
  );
});

export default TickerBar;
