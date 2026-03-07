import { useEffect, useState, useCallback, useRef } from 'react';
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

  // buffer updates to avoid hammering state during bursty ticks
  const pending = useRef<Map<string, Ticker>>(new Map());
  const scheduled = useRef(false);

  const flush = () => {
    setTickers((prev) => {
      if (pending.current.size === 0) return prev;
      const copy = [...prev];
      let changed = false;
      pending.current.forEach((incoming, sym) => {
        const idx = copy.findIndex((t) => t.symbol === sym);
        const last = incoming.last;
        const change24h = idx !== -1 && copy[idx].last
          ? ((last - copy[idx].last) / copy[idx].last) * 100
          : 0;
        const entry: Ticker = { symbol: sym, last, change24h };
        if (idx === -1) {
          copy.push(entry);
          changed = true;
        } else {
          if (copy[idx].last !== last || copy[idx].change24h !== change24h) {
            copy[idx] = entry;
            changed = true;
          }
        }
      });
      pending.current.clear();
      return changed ? copy : prev;
    });
    scheduled.current = false;
  };

  const handleMessage = useCallback((msg: any) => {
    if (msg.type === 'v2/ticker') {
      const last = Number(msg.last_price);
      const change24h = 0; // will compute relative to previous in flush
      // store update
      pending.current.set(msg.symbol, { symbol: msg.symbol, last, change24h });
      if (!scheduled.current) {
        scheduled.current = true;
        requestAnimationFrame(flush);
      }
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
