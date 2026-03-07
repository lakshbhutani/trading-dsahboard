import { useEffect, useState, useCallback } from 'react';
import { wsService } from '../ws/WebSocketService';

export interface Level {
  price: number;
  size: number;
}

export function useOrderBook(symbol: string) {
  const [bids, setBids] = useState<Level[]>([]);
  const [asks, setAsks] = useState<Level[]>([]);

  const handleMessage = useCallback((msg: any) => {
    if (msg.channel === 'l2_orderbook' && msg.symbol === symbol) {
      // naive full snapshot replacement for now
      if (msg.action === 'snapshot') {
        setBids(msg.bids);
        setAsks(msg.asks);
      } else if (msg.action === 'update') {
        // apply updates (not implemented)
      }
    }
  }, [symbol]);

  useEffect(() => {
    if (!symbol) return;
    wsService.addHandler(handleMessage);
    wsService.subscribe('l2_orderbook', symbol);
    return () => {
      wsService.removeHandler(handleMessage);
      wsService.unsubscribe('l2_orderbook', symbol);
      setBids([]);
      setAsks([]);
    };
  }, [symbol, handleMessage]);

  return { bids, asks };
}
