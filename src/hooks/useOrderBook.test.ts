import { describe, it, expect } from 'vitest';
import { computeFlash, groupLevels, Level } from './useOrderBook';

describe('OrderBook Core Logic', () => {
  describe('groupLevels()', () => {
    it('should correctly round bids DOWN and sort descending', () => {
      const raw: Level[] = [
        { price: 100.5, size: 10, cumulative: 0 },
        { price: 100.1, size: 5, cumulative: 0 },
        { price: 99.8, size: 20, cumulative: 0 },
      ];
      // Group by 1 increment
      const result = groupLevels(raw, 1, true); // true = isBid

      // Bids: 100.5 -> 100, 100.1 -> 100 (merged). 99.8 -> 99.
      expect(result.length).toBe(2);
      expect(result[0]).toEqual({ price: 100, size: 15, cumulative: 15 }); // Merged, size 10+5
      expect(result[1]).toEqual({ price: 99, size: 20, cumulative: 35 });  // Sorted descending
    });

    it('should correctly round asks UP and sort ascending', () => {
      const raw: Level[] = [
        { price: 100.5, size: 10, cumulative: 0 },
        { price: 100.1, size: 5, cumulative: 0 },
        { price: 101.2, size: 20, cumulative: 0 },
      ];
      // Group by 1 increment
      const result = groupLevels(raw, 1, false); // false = isAsk

      // Asks: 100.5 -> 101, 100.1 -> 101 (merged). 101.2 -> 102.
      expect(result.length).toBe(2);
      expect(result[0]).toEqual({ price: 101, size: 15, cumulative: 15 }); // Sorted ascending
      expect(result[1]).toEqual({ price: 102, size: 20, cumulative: 35 });
    });
  });

  describe('computeFlash()', () => {
    const prev = [{ price: 100, size: 10, cumulative: 10 }];

    it('should detect flash up (>= 10% increase)', () => {
      const curr = [{ price: 100, size: 11, cumulative: 11 }]; // +10%
      const flash = computeFlash(prev, curr);
      expect(flash[100]).toBe('up');
    });

    it('should detect flash down (<= 10% decrease)', () => {
      const curr = [{ price: 100, size: 9, cumulative: 9 }]; // -10%
      const flash = computeFlash(prev, curr);
      expect(flash[100]).toBe('down');
    });

    it('should not flash for minor changes (< 10%)', () => {
      const curr = [{ price: 100, size: 10.5, cumulative: 10.5 }]; // +5%
      const flash = computeFlash(prev, curr);
      expect(flash[100]).toBeUndefined();
    });
  });
});