import React, { useState } from 'react';
import ConnectionStatus from './components/ConnectionStatus';
import TickerBar from './components/TickerBar';
import OrderBook from './components/OrderBook';
import TradesFeed from './components/TradesFeed';
import './App.css';

function App() {
  const [focused, setFocused] = useState('BTCUSD');

  // placeholder data
  const tickers = [
    { symbol: 'BTCUSD', last: 62341.5, change24h: 2.34 },
    { symbol: 'ETHUSD', last: 1742.18, change24h: -1.12 },
    { symbol: 'XRPUSD', last: 1.4523, change24h: 0.89 },
    { symbol: 'SOLUSD', last: 74.2310, change24h: 5.67 },
    { symbol: 'PAXGUSD', last: 5231.45, change24h: -0.32 },
    { symbol: 'DOGEUSD', last: 0.054231, change24h: 3.21 }
  ];

  const bids = Array.from({ length: 20 }, (_, i) => ({ price: 62341 - i, size: Math.random() * 5, cumulative: 0 }));
  const asks = Array.from({ length: 20 }, (_, i) => ({ price: 62341 + i, size: Math.random() * 5, cumulative: 0 }));

  return (
    <div className="App">
      <ConnectionStatus status="connected" />
      <TickerBar tickers={tickers} focused={focused} onSelect={setFocused} />
      <div className="main-panel">
        <div className="panel orderbook-panel">
          <OrderBook bids={bids} asks={asks} />
        </div>
        <div className="panel trades-panel">
          <TradesFeed trades={[]} />
        </div>
      </div>
    </div>
  );
}

export default App;
