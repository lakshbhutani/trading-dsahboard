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
}

export interface RollingStats {
  buyVolume: number;
  sellVolume: number;
  count: number;
  avgSize: number;
}

const AGG_WINDOW_MS = 100;

export function useTrades(symbol: string, largeNotional = 10000) {
  const [aggTrades, setAggTrades] = useState<AggTrade[]>([]);
  const [stats, setStats] = useState<RollingStats>({ buyVolume: 0, sellVolume: 0, count: 0, avgSize: 0 });

  const pendingTradesRef = useRef<RawTrade[]>([]);
  const tradesWindowRef = useRef<RawTrade[]>([]);
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);

  const flushTrades = useCallback(() => {
    const pending = pendingTradesRef.current;
    if (pending.length === 0) {
      flushTimerRef.current = null;
      return;
    }

    const now = Date.now();
    const cutoff = now - 60000;

    // 1. Update Rolling Window (for stats)
    tradesWindowRef.current.push(...pending);
    // Filter old trades (ensure timestamp is in ms)
    tradesWindowRef.current = tradesWindowRef.current.filter(t => t.timestamp > cutoff);

    // Calculate Stats
    const buyTrades = tradesWindowRef.current.filter(t => t.side === 'buy');
    const sellTrades = tradesWindowRef.current.filter(t => t.side === 'sell');
    const buyVolume = buyTrades.reduce((sum, t) => sum + t.size, 0);
    const sellVolume = sellTrades.reduce((sum, t) => sum + t.size, 0);
    const count = tradesWindowRef.current.length;
    const avgSize = count > 0 ? tradesWindowRef.current.reduce((sum, t) => sum + t.size, 0) / count : 0;

    setStats({ buyVolume, sellVolume, count, avgSize });

    // 2. Aggregate Pending Trades (for display)
    const merged = new Map<string, AggTrade>();
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

    const newAggTrades = Array.from(merged.values());
    // Prepend new trades to the list and limit to 500
    setAggTrades(prev => [...newAggTrades, ...prev].slice(0, 500));

    pendingTradesRef.current = [];
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
      else if (ts > 1000000000000000) ts = ts / 1000; // microseconds -> ms

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
      pendingTradesRef.current = [];
      tradesWindowRef.current = [];
    };
  }, [symbol, handleMessage]);

  return { aggTrades, stats };
}
