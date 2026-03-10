import { useEffect, useState, useCallback, useRef } from 'react';
import { wsService } from '../ws/WebSocketService';
import { SYMBOL_PRECISION } from '../constants';

interface Ticker {
  symbol: string;
  last: number;
  change24h: number;
  open: number;
}


export function useTickers() {
  const [tickers, setTickers] = useState<Ticker[]>([]);

  const handleMessage = useCallback((msg: any) => {
    const isTicker = msg.type === 'v2/ticker';

    if (isTicker) {
      const last = Number(msg.last_price);
      if (isNaN(last)) return;

      if (msg.symbol) {
        const sym = typeof msg.symbol === 'string' ? msg.symbol.toUpperCase() : msg.symbol;
        setTickers((prev) => {
          const copy = [...prev];
          const idx = copy.findIndex((t) => t.symbol === sym);
          
          const open = idx !== -1 ? copy[idx].open : last;
          const change24h = ((last - open) / open) * 100;
          
          const entry: Ticker = { symbol: sym, last, change24h, open };
          if (idx === -1) copy.push(entry);
          else copy[idx] = entry;
          return copy;
        });
      }
    }
  }, []);

  useEffect(() => {
    wsService.addHandler(handleMessage);
    const symbols = Object.keys(SYMBOL_PRECISION);
    wsService.subscribe('v2/ticker', symbols);
    return () => {
      wsService.unsubscribe('v2/ticker', symbols);
      wsService.removeHandler(handleMessage);
    };
  }, [handleMessage]);
  return tickers;
}
