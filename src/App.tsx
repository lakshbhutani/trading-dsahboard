import React, { useState, useEffect } from 'react';
import ConnectionStatus from './components/ConnectionStatus';
import TickerBarInternal from './components/TickerBar';
import OrderBookInternal from './components/OrderBook';
import TradesFeedInternal from './components/TradesFeed';
import { wsService } from './ws/WebSocketService';
import { useTickerStream } from './hooks/useTickers';
import { useOrderBook } from './hooks/useOrderBook';
import { useTrades } from './hooks/useTrades';
import { groupingOptionsFor } from './constants';
import './App.css';

const OrderBook = React.memo(({ focused }: { focused: string }) => {
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

  return (
    <OrderBookInternal
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
  );
});
OrderBook.displayName = 'OrderBook';

const TradesFeed = React.memo(({ focused, threshold, onThresholdChange }: { focused: string; threshold: number; onThresholdChange: (n: number) => void }) => {
  const { aggTrades: trades, stats } = useTrades(focused, threshold);
  return <TradesFeedInternal trades={trades} stats={stats} largeThreshold={threshold} onThresholdChange={onThresholdChange} />;
});
TradesFeed.displayName = 'TradesFeed';

function App() {
  useTickerStream();

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

  const [threshold, setThreshold] = useState<number>(() => {
    const t = Number(localStorage.getItem('threshold'));
    return t || 10000;
  });

  useEffect(() => {
    localStorage.setItem('threshold', String(threshold));
  }, [threshold]);

  // persist focused symbol
  React.useEffect(() => {
    localStorage.setItem('focused', focused);
  }, [focused]);

  return (
    <div className="App">
      <ConnectionStatus status={connStatus} />
      <TickerBarInternal focused={focused} onSelect={setFocused} />
      <div className="main-panel">
        <div className="panel orderbook-panel">
          <h2>{focused} Order Book</h2>
          <OrderBook focused={focused} />
        </div>
        <div className="panel trades-panel" style={{ position: "relative" }}>
          <h2>{focused} Trades</h2>
          <TradesFeed
            focused={focused}
            threshold={threshold}
            onThresholdChange={setThreshold}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
