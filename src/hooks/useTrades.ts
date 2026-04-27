import { useEffect, useState, useCallback, useRef } from 'react';
import { wsService } from '../ws/WebSocketService';

export interface RawTrade {
  time: string;
  price: number;
  size: number;
  side: 'buy' | 'sell';
  notional: number;
  timestamp: number;
}

export interface AggTrade extends RawTrade {
  count: number;
  id: string;
}

export interface RollingStats {
  buyVolume: number;
  sellVolume: number;
  count: number;
  avgSize: number;
}

const AGG_WINDOW_MS = 100;
const MAX_TRADES_WINDOW_SIZE = 500; // Cap to prevent unbounded memory growth
let nextTradeId = 0; // Auto-incrementing ID for fast, zero-GC React keys

// Extracted pure function for testing trade aggregation
export const aggregatePendingTrades = (pending: RawTrade[], merged: Map<string, Omit<AggTrade, 'id'>>) => {
  for (const t of pending) {
    const key = `${t.price}-${t.side}`;
    const existing = merged.get(key);
    if (existing) {
      existing.size += t.size;
      existing.notional += t.notional;
      existing.count += 1;
      // keep latest timestamp
      if (t.timestamp > existing.timestamp) {
        existing.time = t.time;
        existing.timestamp = t.timestamp;
      }
    } else {
      merged.set(key, { ...t, count: 1 });
    }
  }
};

export function useTrades(symbol: string, largeNotional = 10000) {
  const [aggTrades, setAggTrades] = useState<AggTrade[]>([]);
  const [stats, setStats] = useState<RollingStats>({ buyVolume: 0, sellVolume: 0, count: 0, avgSize: 0 });

  const pendingTradesRef = useRef<RawTrade[]>([]);
  const tradesWindowRef = useRef<RawTrade[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mergedMapRef = useRef(new Map<string, Omit<AggTrade, 'id'>>());

  // Separate stats calculation to run every second (per requirements)
  // This ensures stats decay even if no new trades come in.
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const cutoff = now - 60000;

      // Trades are pushed chronologically, so we can find the first valid index
      // instead of iterating through the entire array with .filter()
      const win = tradesWindowRef.current;
      let startIdx = 0;
      while (startIdx < win.length && win[startIdx].timestamp <= cutoff) {
        startIdx++;
      }
      if (startIdx > 0) {
        tradesWindowRef.current = win.slice(startIdx);
      }

      const currentWin = tradesWindowRef.current;
      let buyVolume = 0;
      let sellVolume = 0;
      
      for (let i = 0; i < currentWin.length; i++) {
        if (currentWin[i].side === 'buy') buyVolume += currentWin[i].size;
        else sellVolume += currentWin[i].size;
      }
      const count = currentWin.length;
      const avgSize = count > 0 ? (buyVolume + sellVolume) / count : 0;

      setStats(prev => {
        // Bail out of the React render cycle if the stats haven't changed
        if (
          prev.buyVolume === buyVolume &&
          prev.sellVolume === sellVolume &&
          prev.count === count &&
          prev.avgSize === avgSize
        ) {
          return prev;
        }
        return { buyVolume, sellVolume, count, avgSize };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const flushTrades = useCallback(() => {
    const pending = pendingTradesRef.current;
    if (pending.length === 0) {
      flushTimerRef.current = null;
      return;
    }

    // 1. Update Rolling Window (for stats)
    tradesWindowRef.current.push(...pending);
     if (tradesWindowRef.current.length > MAX_TRADES_WINDOW_SIZE) {
      tradesWindowRef.current = tradesWindowRef.current.slice(-MAX_TRADES_WINDOW_SIZE);
    }

    // 2. Aggregate Pending Trades (for display)
    const merged = mergedMapRef.current;
    aggregatePendingTrades(pending, merged);

    const newAggTrades: AggTrade[] = Array.from(merged.values()).map(t => ({
      ...t,
      id: String(nextTradeId++)
    }));
    // Prepend new trades to the list and limit to 50 for optimal DOM performance
    setAggTrades(prev => [...newAggTrades, ...prev].slice(0, 80));

    pendingTradesRef.current.length = 0; // Empty the array without allocating a new one
    merged.clear(); // Clear the map to release references immediately
    flushTimerRef.current = null;
  }, []);

  const handleMessage = useCallback((msg: any) => {
    const isTrade =
      msg.type === 'all_trades' ||
      msg.type === 'trade' ||
      msg.type === 'trades' ||
      msg.channel === 'all_trades' ||
      msg.channel === 'trade' ||
      msg.channel === 'trades';

    const msgSym = typeof msg.symbol === 'string' ? msg.symbol.toUpperCase() : msg.symbol;
    const targetSym = symbol.toUpperCase();

    if (isTrade && msgSym === targetSym) {
      // Normalize timestamp to milliseconds
      let ts = Number(msg.timestamp);
      if (!ts) ts = Date.now();
      else if (ts > 1e17) ts = Math.floor(ts / 1000000); // nanoseconds -> ms
      else if (ts > 1e14) ts = Math.floor(ts / 1000); // microseconds -> ms

      const raw: RawTrade = {
        time: new Date(ts).toISOString().substr(11, 12),
        price: Number(msg.price),
        size: Number(msg.size),
        side: msg.buyer_role === 'maker' ? 'sell' : 'buy',
        notional: Number(msg.price) * Number(msg.size),
        timestamp: ts,
      };

      pendingTradesRef.current.push(raw);
      if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(flushTrades, AGG_WINDOW_MS);
      }
    }
  }, [symbol, flushTrades]);

  useEffect(() => {
    if (!symbol) return;
    wsService.addHandler(handleMessage);
    wsService.subscribe('all_trades', symbol);
    return () => {
      wsService.removeHandler(handleMessage);
      wsService.unsubscribe('all_trades', symbol);
      
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      setAggTrades([]);
      setStats({ buyVolume: 0, sellVolume: 0, count: 0, avgSize: 0 });
      pendingTradesRef.current.length = 0;
      tradesWindowRef.current.length = 0;
      mergedMapRef.current.clear();
    };
  }, [symbol, handleMessage]);

  return { aggTrades, stats };
}
