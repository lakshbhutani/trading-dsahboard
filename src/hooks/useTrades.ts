import { useEffect, useState, useCallback } from 'react';
import { wsService } from '../ws/WebSocketService';

export interface RawTrade {
  time: string;
  price: number;
  size: number;
  side: 'buy' | 'sell';
  notional: number;
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

export function useTrades(symbol: string, largeNotional = 10000) {
  const [aggTrades, setAggTrades] = useState<AggTrade[]>([]);
  const statsRef = useRef<RollingStats>({ buyVolume: 0, sellVolume: 0, count: 0, avgSize: 0 });
  const tradesWindow = useRef<RawTrade[]>([]);
  const pending = useRef<AggTrade[]>([]);
  const flushTimer = useRef<number>();

  const addToWindow = (t: RawTrade) => {
    const now = Date.now();
    tradesWindow.current.push(t);
    // remove older than 60s
    tradesWindow.current = tradesWindow.current.filter((x) => now - new Date('1970-01-01T' + x.time).getTime() <= 60000);
    // recompute stats
    const buyVol = tradesWindow.current.filter((x) => x.side === 'buy').reduce((s, x) => s + x.size, 0);
    const sellVol = tradesWindow.current.filter((x) => x.side === 'sell').reduce((s, x) => s + x.size, 0);
    const count = tradesWindow.current.length;
    const avgSize = count ? tradesWindow.current.reduce((s,x)=>s+x.size,0)/count : 0;
    statsRef.current = { buyVolume: buyVol, sellVolume: sellVol, count, avgSize };
  };

  const handleMessage = useCallback((msg: any) => {
    if (msg.type === 'all_trades' && msg.symbol === symbol) {
      const raw: RawTrade = {
        time: new Date(msg.timestamp / 1000).toISOString().substr(11, 12),
        price: Number(msg.price),
        size: Number(msg.size),
        side: msg.buyer_role === 'maker' ? 'sell' : 'buy',
        notional: Number(msg.price) * Number(msg.size),
      };
      addToWindow(raw);
      // aggregate
      const existing = pending.current.find((p) => p.price === raw.price && p.side === raw.side);
      if (existing) {
        existing.size += raw.size;
        existing.notional += raw.notional;
        existing.count += 1;
      } else {
        pending.current.push({ ...raw, count: 1 });
      }
      if (!flushTimer.current) {
        flushTimer.current = window.setTimeout(() => {
          setAggTrades((prev) => [...pending.current, ...prev].slice(0, 1000));
          pending.current = [];
          flushTimer.current = undefined;
        }, 100);
      }
    }
  }, [symbol]);

  useEffect(() => {
    if (!symbol) return;
    wsService.addHandler(handleMessage);
    wsService.subscribe('all_trades', symbol);
    return () => {
      wsService.removeHandler(handleMessage);
      wsService.unsubscribe('all_trades', symbol);
      setAggTrades([]);
      tradesWindow.current = [];
    };
  }, [symbol, handleMessage]);

  return { aggTrades, stats: statsRef.current };
}
