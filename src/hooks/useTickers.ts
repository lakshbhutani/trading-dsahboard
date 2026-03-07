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
    const isTicker =
      msg.type === 'v2/ticker' ||
      msg.type === 'ticker' ||
      msg.type === 'tickers' ||
      msg.channel === 'v2/ticker' ||
      msg.channel === 'ticker' ||
      msg.channel === 'tickers';

    if (isTicker) {
      const last = Number(msg.last_price || msg.lastPrice || msg.price);
      console.debug('[useTickers] tick msg', msg.symbol, last, 'raw', msg);
      const change24h = 0; // will compute relative to previous in flush
      pending.current.set(msg.symbol, { symbol: msg.symbol, last, change24h });
      if (!scheduled.current) {
        scheduled.current = true;
        requestAnimationFrame(flush);
      }
    } else if ((msg.type && msg.type.includes('ticker')) || (msg.channel && msg.channel.includes('ticker'))) {
      console.debug('[useTickers] other ticker-like message', msg);
    }
  }, []);

  useEffect(() => {
    console.debug('[useTickers] mounting, subscribing to ticker channels (all symbols)');
    wsService.addHandler(handleMessage);
    // server requires at least one symbol in the subscription set, so
    // we iterate known symbols and add them individually.  this mirrors the
    // behaviour we had when the backend treated a missing "symbols" field
    // as "all".
    const symbols = Object.keys(SYMBOL_PRECISION);
    symbols.forEach((sym) => {
      wsService.subscribe('v2/ticker', sym);
      wsService.subscribe('ticker' as any, sym); // alias
      wsService.subscribe('tickers' as any, sym);
    });
    console.debug('[useTickers] subscriptions', wsService.getSubscriptions());
    return () => {
      console.debug('[useTickers] unmounting, unsubscribing');
      symbols.forEach((sym) => {
        wsService.unsubscribe('v2/ticker', sym);
        wsService.unsubscribe('ticker' as any, sym);
        wsService.unsubscribe('tickers' as any, sym);
      });
      wsService.removeHandler(handleMessage);
    };
  }, [handleMessage]);

  return tickers;
}
