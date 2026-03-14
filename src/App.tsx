import React, { useState, useEffect, useCallback } from 'react';
import ConnectionStatus from './components/ConnectionStatus';
import TickerBar from './components/TickerBar';
import OrderBook from './components/OrderBook';
import TradesFeed from './components/TradesFeed';
import { wsService } from './ws/WebSocketService';
import { useTickers } from './hooks/useTickers';
import { useOrderBook } from './hooks/useOrderBook';
import { useTrades } from './hooks/useTrades';
import { groupingOptionsFor } from './constants';
import './App.css';

function App() {
  const [focused, setFocused] = useState<string>(() => {
    try {
      return localStorage.getItem('focused') || 'BTCUSD';
    } catch {
      return 'BTCUSD';
    }
  });

  // initialize websocket connection once
  const [connStatus, setConnStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');

  useEffect(() => {
    wsService.addStatusHandler(setConnStatus);
    // log every incoming message for dev visibility
    wsService.connect('ws://localhost:8080');
    return () => {
      wsService.removeStatusHandler(setConnStatus);
    };
  }, []);

  // hooks that manage live data
  const tickers = useTickers();
  const {
    groupedBids,
    groupedAsks,
    midPrice,
    spread,
    spreadBps,
    imbalance,
    setGroup,
    group,
    flashBids,
    flashAsks,
  } = useOrderBook(focused);
  const [threshold, setThreshold] = useState<number>(() => {
    const t = Number(localStorage.getItem('threshold'));
    return t || 10000;
  });
  const { aggTrades: trades, stats } = useTrades(focused, threshold);

  useEffect(() => {
    localStorage.setItem('threshold', String(threshold));
  }, [threshold]);

  // persist focused symbol
  React.useEffect(() => {
    localStorage.setItem('focused', focused);
  }, [focused]);

  return (
    <div className="App">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ConnectionStatus status={connStatus} />
        {/* <pre style={{ color: '#0f0', fontSize: '10px' }}>
          {JSON.stringify(wsService.getSubscriptions(), null, 2)}
        </pre> */}
      </div>
      <TickerBar tickers={tickers} focused={focused} onSelect={setFocused} />
      <div className="main-panel">
        <div className="panel orderbook-panel">
          <h2>{focused} Order Book</h2>
          <OrderBook
            groupedBids={groupedBids}
            groupedAsks={groupedAsks}
            midPrice={midPrice}
            spread={spread}
            spreadBps={spreadBps}
            imbalance={imbalance}
            group={group}
            onGroupChange={setGroup}
            groupOptions={groupingOptionsFor(focused)}
            flashBids={flashBids}
            flashAsks={flashAsks}
          />
        </div>
        <div className="panel trades-panel" style={{ position: 'relative' }}>
          <h2>{focused} Trades</h2>
          <TradesFeed
            trades={trades}
            stats={stats}
            largeThreshold={threshold}
            onThresholdChange={setThreshold}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
