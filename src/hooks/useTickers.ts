import { useEffect, useState, useCallback } from 'react';
import { wsService } from '../ws/WebSocketService';

interface Ticker {
  symbol: string;
  last: number;
  change24h: number;
}

// list of all symbols we care about
const ALL_SYMBOLS = ['BTCUSD','ETHUSD','XRPUSD','SOLUSD','PAXGUSD','DOGEUSD'];

export function useTickers() {
  const [tickers, setTickers] = useState<Ticker[]>([]);

  const handleMessage = useCallback((msg: any) => {
    if (msg.type === 'v2/ticker') {
      const last = Number(msg.last_price);
      setTickers((prev) => {
        const idx = prev.findIndex((t) => t.symbol === msg.symbol);
        const change24h = prev[idx]?.last ? ((last - prev[idx].last) / prev[idx].last) * 100 : 0;
        const newEntry: Ticker = { symbol: msg.symbol, last, change24h };
        if (idx === -1) {
          return [...prev, newEntry];
        } else {
          const updated = [...prev];
          updated[idx] = newEntry;
          return updated;
        }
      });
    }
  }, []);

  useEffect(() => {
    wsService.addHandler(handleMessage);
    // subscribe for every symbol individually - server requires symbols array
    ALL_SYMBOLS.forEach((sym) => wsService.subscribe('v2/ticker', sym));
    return () => {
      wsService.removeHandler(handleMessage);
      ALL_SYMBOLS.forEach((sym) => wsService.unsubscribe('v2/ticker', sym));
    };
  }, [handleMessage]);

  return tickers;
}
