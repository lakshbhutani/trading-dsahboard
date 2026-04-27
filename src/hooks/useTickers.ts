import { useEffect, useState } from 'react';
import { wsService } from '../ws/WebSocketService';
import { SYMBOL_PRECISION } from '../constants';

export interface Ticker {
  symbol: string;
  last: number;
  change24h: number;
  open: number;
}

const tickerChannel = 'v2/ticker' as const;
export const tickerSymbols = Object.keys(SYMBOL_PRECISION);

const tickerMap = new Map<string, Ticker>();
const listenersBySymbol = new Map<string, Set<(ticker: Ticker | null) => void>>();

function subscribe(symbol: string, listener: (ticker: Ticker | null) => void) {
  let listeners = listenersBySymbol.get(symbol);
  if (!listeners) {
    listeners = new Set();
    listenersBySymbol.set(symbol, listeners);
  }

  listeners.add(listener);
  listener(tickerMap.get(symbol) ?? null);

  return () => {
    listeners!.delete(listener);
    if (listeners!.size === 0) {
      listenersBySymbol.delete(symbol);
    }
  };
}

function handleTickerMessage(msg: any) {
  if (msg.type !== tickerChannel) return;

  const last = Number(msg.last_price);
  if (Number.isNaN(last) || !msg.symbol) return;

  const symbol = typeof msg.symbol === 'string' ? msg.symbol.toUpperCase() : String(msg.symbol);
  const prev = tickerMap.get(symbol);
  const open = prev ? prev.open : last;
  const change24h = open === 0 ? 0 : ((last - open) / open) * 100;

  if (prev && prev.last === last && prev.change24h === change24h) {
    return;
  }

  const next: Ticker = { symbol, last, change24h, open };
  tickerMap.set(symbol, next);
  const listeners = listenersBySymbol.get(symbol);
  if (listeners) {
    listeners.forEach((listener) => listener(next));
  }
}

export function useTicker(symbol: string) {
  const [ticker, setTicker] = useState<Ticker | null>(() => tickerMap.get(symbol) ?? null);

  useEffect(() => {
    return subscribe(symbol, setTicker);
  }, [symbol]);

  return ticker;
}

export function useTickerStream() {
  useEffect(() => {
    wsService.addHandler(handleTickerMessage);
    wsService.subscribe(tickerChannel, tickerSymbols);
    return () => {
      wsService.unsubscribe(tickerChannel, tickerSymbols);
      wsService.removeHandler(handleTickerMessage);
    };
  }, []);
}
