import { useEffect, useState, useCallback } from 'react';
import { wsService, Channel } from '../ws/WebSocketService';

interface Ticker {
  symbol: string;
  last: number;
  change24h: number;
}

export function useTickers() {
  const [tickers, setTickers] = useState<Ticker[]>([]);

  const handleMessage = useCallback((msg: any) => {
    if (msg.channel === 'v2/ticker') {
      setTickers((prev) => {
        const idx = prev.findIndex((t) => t.symbol === msg.symbol);
        if (idx === -1) {
          return [...prev, msg];
        } else {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...msg };
          return updated;
        }
      });
    }
  }, []);

  useEffect(() => {
    wsService.addHandler(handleMessage);
    wsService.subscribe('v2/ticker');
    return () => {
      wsService.removeHandler(handleMessage);
      wsService.unsubscribe('v2/ticker');
    };
  }, [handleMessage]);

  return tickers;
}
