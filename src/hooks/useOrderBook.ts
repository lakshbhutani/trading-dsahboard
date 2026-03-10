
import { useEffect, useState, useCallback, useRef } from 'react';
import { wsService } from '../ws/WebSocketService';
import { groupingOptionsFor } from '../constants';

const eqLevels = (a: Level[], b: Level[]) =>
  a.length === b.length && a.every((l, i) => l.price === b[i].price && l.size === b[i].size);

const computeFlash = (prev: Level[], curr: Level[]) => {
  const flash: Record<number, 'up' | 'down'> = {};
  const prevMap = new Map(prev.map((l) => [l.price, l.size]));
  for (const lvl of curr) {
    const old = prevMap.get(lvl.price) || 0;
    if (old > 0) {
      const diff = (lvl.size - old) / old;
      if (diff >= 0.1) flash[lvl.price] = 'up';
      else if (diff <= -0.1) flash[lvl.price] = 'down';
    }
  }
  return flash;
};

const computeCumulative = (levels: Level[]): Level[] => {
  let cum = 0;
  return levels.map((l) => ({ ...l, cumulative: (cum += l.size) }));
};

const groupLevels = (levels: Level[], increment: number, isBid: boolean): Level[] => {
  const map = new Map<number, number>();
  for (const lvl of levels) {
    const price = isBid ? Math.floor(lvl.price / increment) * increment : Math.ceil(lvl.price / increment) * increment;
    map.set(price, (map.get(price) || 0) + lvl.size);
  }
  const arr = Array.from(map.entries()).map(([price, size]) => ({ price, size, cumulative: 0 }));
  arr.sort((a, b) => (isBid ? b.price - a.price : a.price - b.price));
  return computeCumulative(arr);
};
export interface Level {
  price: number;
  size: number;
  cumulative: number;
}

export interface OrderbookState {
  bids: Level[];
  asks: Level[];
  groupedBids: Level[];
  groupedAsks: Level[];
  midPrice?: number;
  spread?: number;
  spreadBps?: number;
  imbalance?: number;
  setGroup: (g: number) => void;
  group: number;
  flashBids: Record<number, 'up' | 'down'>;
  flashAsks: Record<number, 'up' | 'down'>;
}

export function useOrderBook(symbol: string): OrderbookState {
  const [rawBids, setRawBids] = useState<Level[]>([]);
  const [rawAsks, setRawAsks] = useState<Level[]>([]);
  const [group, setGroup] = useState<number>(groupingOptionsFor(symbol)[0] || 1);

  const [groupedBids, setGroupedBids] = useState<Level[]>([]);
  const [groupedAsks, setGroupedAsks] = useState<Level[]>([]);
  // derived metrics (batched together to avoid multiple state updates per render)
  const [derived, setDerived] = useState<{
    midPrice?: number;
    spread?: number;
    spreadBps?: number;
    imbalance?: number;
  }>({});

  // We store flash in state now because it comes from the worker
  const [flashes, setFlashes] = useState<{
    bids: Record<number, 'up' | 'down'>;
    asks: Record<number, 'up' | 'down'>;
  }>({ bids: {}, asks: {} });

  // rAF optimization refs
  const rawBidsRef = useRef<Level[]>([]);
  const rawAsksRef = useRef<Level[]>([]);
  const latestRawDataRef = useRef<{ bids: Level[]; asks: Level[] } | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  const prevGroupedBidsRef = useRef<Level[]>([]);
  const prevGroupedAsksRef = useRef<Level[]>([]);

  const calcDerived = (gb: Level[], ga: Level[], bestBid: number, bestAsk: number) => {
    const mid = (bestBid + bestAsk) / 2;
    const sp = bestAsk - bestBid;
    const bidVol = gb.length > 0 ? gb[gb.length - 1].cumulative : 0;
    const askVol = ga.length > 0 ? ga[ga.length - 1].cumulative : 0;
    return {
      midPrice: mid,
      spread: sp,
      spreadBps: mid > 0 ? (sp / mid) * 10000 : 0,
      imbalance: bidVol / (askVol || 1),
    };
  };

  const throttledUpdate = useCallback(() => {
    if (latestRawDataRef.current) {
      const { bids, asks } = latestRawDataRef.current;
      latestRawDataRef.current = null;

      rawBidsRef.current = bids;
      rawAsksRef.current = asks;

      setRawBids(bids);
      setRawAsks(asks);

      const gb = groupLevels(bids, group, true);
      const ga = groupLevels(asks, group, false);

      const flashBids = computeFlash(prevGroupedBidsRef.current, gb);
      const flashAsks = computeFlash(prevGroupedAsksRef.current, ga);

      prevGroupedBidsRef.current = gb;
      prevGroupedAsksRef.current = ga;

      setGroupedBids(gb);
      setGroupedAsks(ga);
      setFlashes({ bids: flashBids, asks: flashAsks });

      if (bids.length && asks.length) {
        setDerived(calcDerived(gb, ga, bids[0].price, asks[0].price));
      }
    }
    animationFrameIdRef.current = null;
  }, [group]);

  // Handle group changes
  useEffect(() => {
    const bids = rawBidsRef.current;
    const asks = rawAsksRef.current;
    if (!bids.length && !asks.length) return;

    const gb = groupLevels(bids, group, true);
    const ga = groupLevels(asks, group, false);

    setGroupedBids(gb);
    setGroupedAsks(ga);
    setFlashes({ bids: {}, asks: {} }); // Reset flashes on group change

    if (bids.length && asks.length) {
      setDerived(calcDerived(gb, ga, bids[0].price, asks[0].price));
    }
  }, [group]);

  const handleMessage = useCallback((msg: any) => {
    // console.log('handleMessage----', msg)
    // sample payload contains type:'l2_orderbook', symbol:'SOLUSD', bids:[["70.4863","1.2697"],...]
    const msgSym = typeof msg.symbol === 'string' ? msg.symbol.toUpperCase() : msg.symbol;
    const targetSym = symbol.toUpperCase();
    if (msg.type === 'l2_orderbook' && msgSym === targetSym) {
      const convert = (arr: any[]) => arr.map(([p, s]: any) => ({ price: Number(p), size: Number(s), cumulative: 0 }));
      const bids = convert(msg.bids);
      bids.sort((a, b) => b.price - a.price);
      const asks = convert(msg.asks);
      asks.sort((a, b) => a.price - b.price);
      latestRawDataRef.current = { bids, asks };
      if (!animationFrameIdRef.current) {
        animationFrameIdRef.current = requestAnimationFrame(throttledUpdate);
      }
    }
  }, [symbol, throttledUpdate]);

  useEffect(() => {
    if (!symbol) return;
    wsService.addHandler(handleMessage);
    wsService.subscribe('l2_orderbook', symbol);
    return () => {
      wsService.removeHandler(handleMessage);
      wsService.unsubscribe('l2_orderbook', symbol);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [symbol, handleMessage]);

  // update grouping options when symbol changes
  useEffect(() => {
    const opts = groupingOptionsFor(symbol);
    const stored = Number(localStorage.getItem(`group_${symbol}`));
    if (opts.includes(stored)) {
      setGroup(stored);
    } else {
      setGroup(opts[0] || 1);
    }
    // clear previous book when switching symbols to avoid visual artifacts
    setRawBids([]);
    setRawAsks([]);
    setGroupedBids([]);
    setGroupedAsks([]);
  }, [symbol]);

  // save group changes
  useEffect(() => {
    if (symbol) {
      localStorage.setItem(`group_${symbol}`, String(group));
    }
  }, [group, symbol]);

  return {
    bids: rawBids,
    asks: rawAsks,
    groupedBids,
    groupedAsks,
    midPrice: derived.midPrice,
    spread: derived.spread,
    spreadBps: derived.spreadBps,
    imbalance: derived.imbalance,
    setGroup,
    group,
    flashBids: flashes.bids,
    flashAsks: flashes.asks,
  };
}
