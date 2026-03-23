import { describe, it, expect } from 'vitest';
import { aggregatePendingTrades, RawTrade, AggTrade } from './useTrades';

describe('Trade Aggregation Logic', () => {
  it('should aggregate trades with the same price and side', () => {
    const pending: RawTrade[] = [
      { price: 100, side: 'buy', size: 1, notional: 100, time: '10:00:00', timestamp: 1000 },
      { price: 100, side: 'buy', size: 2, notional: 200, time: '10:00:01', timestamp: 1001 },
      { price: 100, side: 'sell', size: 5, notional: 500, time: '10:00:02', timestamp: 1002 },
    ];

    const mergedMap = new Map<string, Omit<AggTrade, 'id'>>();
    aggregatePendingTrades(pending, mergedMap);

    expect(mergedMap.size).toBe(2);

    const buyTrade = mergedMap.get('100-buy');
    expect(buyTrade).toBeDefined();
    expect(buyTrade?.size).toBe(3);       // 1 + 2
    expect(buyTrade?.notional).toBe(300); // 100 + 200
    expect(buyTrade?.count).toBe(2);      // 2 trades merged
    expect(buyTrade?.timestamp).toBe(1001); // Keeps the latest timestamp
    expect(buyTrade?.time).toBe('10:00:01');

    const sellTrade = mergedMap.get('100-sell');
    expect(sellTrade).toBeDefined();
    expect(sellTrade?.size).toBe(5);
    expect(sellTrade?.count).toBe(1);
  });

  it('should maintain existing items in the map if they arrived in a previous flush', () => {
    const mergedMap = new Map<string, Omit<AggTrade, 'id'>>();
    mergedMap.set('100-buy', { price: 100, side: 'buy', size: 10, notional: 1000, count: 5, time: '10:00:00', timestamp: 1000 });

    const pending: RawTrade[] = [
      { price: 100, side: 'buy', size: 2, notional: 200, time: '10:00:01', timestamp: 1001 },
    ];
    aggregatePendingTrades(pending, mergedMap);

    expect(mergedMap.get('100-buy')?.size).toBe(12); // Should correctly add to the existing 10
  });
});