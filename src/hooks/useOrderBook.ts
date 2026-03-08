
import { useEffect, useState, useCallback, useRef } from 'react';
import { wsService } from '../ws/WebSocketService';
import { groupingOptionsFor } from '../constants';

export interface Level {
  price: number;
  size: number;
  cumulative: number;
}

// Move helper outside to ensure stability and access
const eqLevels = (a: Level[], b: Level[]) =>
  a.length === b.length && a.every((l, i) => l.price === b[i].price && l.size === b[i].size);

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

  const flashBidsRef = useRef<Record<number, 'up' | 'down'>>({});
  const flashAsksRef = useRef<Record<number, 'up' | 'down'>>({});
  const prevGroupedBidsRef = useRef<Level[]>([]);
  const prevGroupedAsksRef = useRef<Level[]>([]);

  // compute cumulative sums
  const computeCumulative = (levels: Level[]): Level[] => {
    let cum = 0;
    return levels.map((l) => ({ ...l, cumulative: (cum += l.size) }));
  };

  const groupLevels = (levels: Level[], increment: number, isBid: boolean): Level[] => {
    const map = new Map<number, number>();
    for (const lvl of levels) {
      const price = isBid
        ? Math.floor(lvl.price / increment) * increment
        : Math.ceil(lvl.price / increment) * increment;
      map.set(price, (map.get(price) || 0) + lvl.size);
    }
    const arr = Array.from(map.entries()).map(([price, size]) => ({ price, size, cumulative: 0 }));
    arr.sort((a, b) => (isBid ? b.price - a.price : a.price - b.price));
    return computeCumulative(arr);
  };

  // compute derived values from raw or grouped data
  // (separate effect to avoid cycles when grouped arrays change)


  // flash computation
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

  // handle grouping whenever raw data or group changes
  useEffect(() => {
    if (!symbol) return;
    const gb = groupLevels(rawBids, group, true);
    const ga = groupLevels(rawAsks, group, false);

    // only update state if the grouped arrays actually changed (avoids
    // triggering a rerender which would re‑run this effect immediately)
    setGroupedBids((prev) => (eqLevels(prev, gb) ? prev : gb));
    setGroupedAsks((prev) => (eqLevels(prev, ga) ? prev : ga));

    // compute flash based on previous grouped data
    const bidFlash: Record<number, 'up' | 'down'> = {};
    const bidPrevMap = new Map(prevGroupedBidsRef.current.map((l) => [l.price, l.size]));
    for (const lvl of gb) {
      const old = bidPrevMap.get(lvl.price) || 0;
      if (old > 0) {
        const diff = (lvl.size - old) / old;
        if (diff >= 0.1) bidFlash[lvl.price] = 'up';
        else if (diff <= -0.1) bidFlash[lvl.price] = 'down';
      }
    }
    flashBidsRef.current = bidFlash;

    const askFlash: Record<number, 'up' | 'down'> = {};
    const askPrevMap = new Map(prevGroupedAsksRef.current.map((l) => [l.price, l.size]));
    for (const lvl of ga) {
      const old = askPrevMap.get(lvl.price) || 0;
      if (old > 0) {
        const diff = (lvl.size - old) / old;
        if (diff >= 0.1) askFlash[lvl.price] = 'up';
        else if (diff <= -0.1) askFlash[lvl.price] = 'down';
      }
    }
    flashAsksRef.current = askFlash;

    // store current for next round
    prevGroupedBidsRef.current = gb;
    prevGroupedAsksRef.current = ga;
  }, [rawBids, rawAsks, group]);

  const handleMessage = useCallback((msg: any) => {
    // console.log('handleMessage----', msg)
    // sample payload contains type:'l2_orderbook', symbol:'SOLUSD', bids:[["70.4863","1.2697"],...]
    const msgSym = typeof msg.symbol === 'string' ? msg.symbol.toUpperCase() : msg.symbol;
    const targetSym = symbol.toUpperCase();
    if (msg.type === 'l2_orderbook' && msgSym === targetSym) {
      const convert = (arr: any[]) => {
        return arr.map(([p, s]: any) => ({ price: Number(p), size: Number(s), cumulative: 0 }));
      };
      const bids = convert(msg.bids);
      bids.sort((a, b) => b.price - a.price);
      const asks = convert(msg.asks);
      asks.sort((a, b) => a.price - b.price);
      setRawBids(bids);
      setRawAsks(asks);
    }
  }, [symbol]);

  useEffect(() => {
    if (!symbol) return;
    wsService.addHandler(handleMessage);
    wsService.subscribe('l2_orderbook', symbol);
    return () => {
      wsService.removeHandler(handleMessage);
      wsService.unsubscribe('l2_orderbook', symbol);
    };
  }, [symbol, handleMessage]);

  // compute derived metrics when raw or grouped data updates
  useEffect(() => {
    if (rawBids.length && rawAsks.length) {
      const bestBid = rawBids[0].price;
      const bestAsk = rawAsks[0].price;
      const mid = (bestBid + bestAsk) / 2;
      const sp = bestAsk - bestBid;
      const bidVol = groupedBids.reduce((s, l) => s + l.size, 0);
      const askVol = groupedAsks.reduce((s, l) => s + l.size, 0);
      setDerived({
        midPrice: mid,
        spread: sp,
        spreadBps: (sp / mid) * 10000,
        imbalance: bidVol / (askVol || 1),
      });
    }
  }, [rawBids, rawAsks, groupedBids, groupedAsks]);

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
    flashBids: flashBidsRef.current,
    flashAsks: flashAsksRef.current,
  };
}
