import React from 'react';
import './TickerBar.css';
import { tickerSymbols, useTicker } from '../hooks/useTickers';

interface Props {
  focused: string;
  onSelect: (symbol: string) => void;
}

const TickerItem = ({
  symbol,
  isFocused,
  onClick,
}: {
  symbol: string;
  isFocused: boolean;
  onClick: (s: string) => void;
}) => {
  console.log("Rendering TickerItem for", symbol);
  const ticker = useTicker(symbol);
  const lastText = ticker ? ticker.last.toFixed(2) : '...';
  const changeText = ticker ? `${ticker.change24h.toFixed(2)}%` : '--';
  const changeClass = ticker ? (ticker.change24h >= 0 ? 'positive' : 'negative') : '';

  return (
    <div className={`ticker-item ${isFocused ? 'focused' : ''}`} onClick={() => onClick(symbol)}>
      <span className="symbol">{symbol}</span>
      <span className="last">{lastText}</span>
      <span className={`change ${changeClass}`}>{changeText}</span>
    </div>
  );
};

const TickerBar: React.FC<Props> = ({ focused, onSelect }) => {
  console.log("Rendering TickerBar");
  return (
    <div className="ticker-bar">
      {tickerSymbols.map((symbol) => (
        <TickerItem key={symbol} symbol={symbol} isFocused={focused === symbol} onClick={onSelect} />
      ))}
    </div>
  );
};

export default TickerBar;
