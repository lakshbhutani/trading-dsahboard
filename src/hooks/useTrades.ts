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

export function useTrades(symbol: string, largeNotional = 10000) {
  const [aggTrades, setAggTrades] = useState<AggTrade[]>([]);
  const statsRef = useRef<RollingStats>({ buyVolume: 0, sellVolume: 0, count: 0, avgSize: 0 });
  const tradesWindow = useRef<RawTrade[]>([]);

  const addToWindow = (t: RawTrade) => {
    const now = Date.now();
    tradesWindow.current.push(t);
    // remove older than 60s
    tradesWindow.current = tradesWindow.current.filter((x) => now - x.timestamp <= 60000);
    // recompute stats
    const buyVol = tradesWindow.current.filter((x) => x.side === 'buy').reduce((s, x) => s + x.size, 0);
    const sellVol = tradesWindow.current.filter((x) => x.side === 'sell').reduce((s, x) => s + x.size, 0);
    const count = tradesWindow.current.length;
    const avgSize = count ? tradesWindow.current.reduce((s,x)=>s+x.size,0)/count : 0;
    statsRef.current = { buyVolume: buyVol, sellVolume: sellVol, count, avgSize };
  };

  const handleMessage = useCallback((msg: any) => {
    // the backend has been sending objects like the sample below:
  // {
  //   "buyer_role":"maker","price":"74.7905","size":103,...
  //   "type":"all_trades","symbol":"SOLUSD",... }
  // timestamps arrive in microseconds so we divide by 1000 later.
  // console.log('handleMessage = useCallback', msg);
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
      const timestamp = (msg.timestamp || Date.now() * 1000) / 1000;
      const raw: RawTrade = {
        time: new Date(timestamp).toISOString().substr(11, 12),
        price: Number(msg.price),
        size: Number(msg.size),
        side: msg.buyer_role === 'maker' ? 'sell' : 'buy',
        notional: Number(msg.price) * Number(msg.size),
        timestamp,
      };
      addToWindow(raw);
      setAggTrades((prev) => {
        return [{ ...raw, count: 1 }, ...prev].slice(0, 1000);
      });
    }
  }, [symbol]);

  useEffect(() => {
    if (!symbol) return;
    wsService.addHandler(handleMessage);
    // subscribe to all trade-related channels for this symbol
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
