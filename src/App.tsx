import React, { useState, useEffect } from 'react';
import ConnectionStatus from './components/ConnectionStatus';
import TickerBar from './components/TickerBar';
import OrderBook from './components/OrderBook';
import TradesFeed from './components/TradesFeed';
import { wsService } from './ws/WebSocketService';
import { useTickers } from './hooks/useTickers';
import { useOrderBook } from './hooks/useOrderBook';
import { useTrades } from './hooks/useTrades';
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
    wsService.connect('ws://localhost:8080');
    return () => {
      wsService.removeStatusHandler(setConnStatus);
    };
  }, []);

  // hooks that manage live data
  const tickers = useTickers();
  const { bids, asks } = useOrderBook(focused);
  const trades = useTrades(focused);

  // persist focused symbol
  React.useEffect(() => {
    localStorage.setItem('focused', focused);
  }, [focused]);

  return (
    <div className="App">
      <ConnectionStatus status={connStatus} />
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
