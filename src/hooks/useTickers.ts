import { useEffect, useState, useCallback, useRef } from 'react';
import { wsService } from '../ws/WebSocketService';
import { SYMBOL_PRECISION } from '../constants';

interface Ticker {
  symbol: string;
  last: number;
  change24h: number;
}


export function useTickers() {
  const [tickers, setTickers] = useState<Ticker[]>([]);

  const handleMessage = useCallback((msg: any) => {
    // console.log('[useTickers] received message:', msg);
    const isTicker =
      msg.type === 'v2/ticker' ||
      msg.type === 'ticker' ||
      msg.channel === 'v2/ticker' ||
      msg.channel === 'ticker';

    if (isTicker) {
      const last = Number(msg.last_price || msg.lastPrice || msg.price);
      if (isNaN(last)) return;
      // console.debug('[useTickers] tick msg', msg.symbol, last, 'raw', msg);
      const change24h = 0; // will compute relative to previous in flush
      if (msg.symbol) {
        const sym = typeof msg.symbol === 'string' ? msg.symbol.toUpperCase() : msg.symbol;
        // console.log('[useTickers] received message:', sym, last, 'raw', msg);
        setTickers((prev) => {
          const copy = [...prev];
          const idx = copy.findIndex((t) => t.symbol === sym);
          const change24h = idx !== -1 && copy[idx].last
            ? ((last - copy[idx].last) / copy[idx].last) * 100
            : 0;
          const entry: Ticker = { symbol: sym, last, change24h };
          if (idx === -1) copy.push(entry);
          else copy[idx] = entry;
          return copy;
        });
      }
    } else if ((msg.type && msg.type.includes('ticker')) || (msg.channel && msg.channel.includes('ticker'))) {
      // console.debug('[useTickers] other ticker-like message', msg);
    }
  }, []);

  useEffect(() => {
    // console.debug('[useTickers] mounting, subscribing to ticker channels (all symbols)');
    wsService.addHandler(handleMessage);
    const symbols = Object.keys(SYMBOL_PRECISION);
    wsService.subscribe('v2/ticker', symbols);
    // console.debug('[useTickers] subscriptions', wsService.getSubscriptions());
    return () => {
      // console.debug('[useTickers] unmounting, unsubscribing');
      wsService.unsubscribe('v2/ticker', symbols);
      wsService.removeHandler(handleMessage);
    };
  }, [handleMessage]);
  return tickers;
}
