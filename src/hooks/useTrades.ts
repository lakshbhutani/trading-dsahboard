import { useEffect, useState, useCallback } from 'react';
import { wsService } from '../ws/WebSocketService';

export interface Trade {
  time: string;
  price: number;
  size: number;
  side: 'buy' | 'sell';
}

export function useTrades(symbol: string) {
  const [trades, setTrades] = useState<Trade[]>([]);

  const handleMessage = useCallback((msg: any) => {
    if (msg.channel === 'all_trades' && msg.symbol === symbol) {
      setTrades((prev) => [msg, ...prev].slice(0, 1000));
    }
  }, [symbol]);

  useEffect(() => {
    if (!symbol) return;
    wsService.addHandler(handleMessage);
    wsService.subscribe('all_trades', symbol);
    return () => {
      wsService.removeHandler(handleMessage);
      wsService.unsubscribe('all_trades', symbol);
      setTrades([]);
    };
  }, [symbol, handleMessage]);

  return trades;
}
