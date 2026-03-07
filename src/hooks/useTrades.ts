import { useEffect, useState, useCallback, useRef } from 'react';
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
  const scheduledFlush = useRef(false);

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

  const flushTrades = () => {
    console.debug('[useTrades] flush called, pending', pending.current.length);
    setAggTrades((prev) => {
      if (pending.current.length === 0) return prev;
      const combined = [...pending.current, ...prev].slice(0, 1000);
      pending.current = [];
      // simple shallow compare
      if (
        combined.length === prev.length &&
        combined.every((v, i) => v.price === prev[i].price && v.size === prev[i].size && v.count === prev[i].count)
      ) {
        console.debug('[useTrades] flush skip – identical');
        return prev;
      }
      console.debug('[useTrades] flush update, new len', combined.length);
      return combined;
    });
    scheduledFlush.current = false;
  };

  const handleMessage = useCallback((msg: any) => {
    // the backend has been sending objects like the sample below:
  // {
  //   "buyer_role":"maker","price":"74.7905","size":103,...
  //   "type":"all_trades","symbol":"SOLUSD",... }
  // timestamps arrive in microseconds so we divide by 1000 later.
  const isTrade =
      msg.type === 'all_trades' ||
      msg.type === 'trade' ||
      msg.type === 'trades' ||
      msg.channel === 'all_trades' ||
      msg.channel === 'trade' ||
      msg.channel === 'trades';
  // normalize symbols so a lower/upper case mismatch won't drop data
  const msgSym = typeof msg.symbol === 'string' ? msg.symbol.toUpperCase() : msg.symbol;
  const targetSym = symbol.toUpperCase();
  if (isTrade && msgSym === targetSym) {
      console.debug('[useTrades] trade msg', msg);
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
      if (!scheduledFlush.current) {
        scheduledFlush.current = true;
        console.debug('[useTrades] scheduling flush');
        requestAnimationFrame(flushTrades);
      }
    }
  }, [symbol]);

  useEffect(() => {
    if (!symbol) return;
    console.debug('[useTrades] effect mount for', symbol);
    wsService.addHandler(handleMessage);
    // subscribe to all trade-related channels for this symbol
    wsService.subscribe('all_trades', symbol);
    wsService.subscribe('trade', symbol);
    wsService.subscribe('trades' as any, symbol);
    return () => {
      console.debug('[useTrades] cleanup for', symbol);
      wsService.removeHandler(handleMessage);
      wsService.unsubscribe('all_trades', symbol);
      wsService.unsubscribe('trade', symbol);
      wsService.unsubscribe('trades' as any, symbol);
      setAggTrades([]);
      tradesWindow.current = [];
    };
  }, [symbol, handleMessage]);
  return { aggTrades, stats: statsRef.current };
}
