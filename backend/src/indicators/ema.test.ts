import { describe, it, expect } from 'vitest';
import { calculateEma, type Candle } from './ema';

const candlesFromCloses = (closes: number[]): Candle[] =>
  closes.map((close, i) => ({ time: new Date(Date.UTC(2026, 0, 1, i)), open: close, high: close, low: close, close }));

describe('calculateEma', () => {
  it('returns an empty series for no candles', () => {
    expect(calculateEma([], 3)).toEqual([]);
  });

  it('is all null when there are fewer candles than the period', () => {
    expect(calculateEma(candlesFromCloses([1, 2]), 3)).toEqual([null, null]);
  });

  it('seeds with the SMA and then applies k = 2 / (period + 1)', () => {
    // closes 1..6, period 3 → k = 0.5
    // index 2: SMA(1,2,3) = 2
    // index 3: 4*0.5 + 2*0.5   = 3
    // index 4: 5*0.5 + 3*0.5   = 4
    // index 5: 6*0.5 + 4*0.5   = 5
    const ema = calculateEma(candlesFromCloses([1, 2, 3, 4, 5, 6]), 3);
    expect(ema).toEqual([null, null, 2, 3, 4, 5]);
  });

  it('keeps the input length and converges toward a flat series', () => {
    const closes = [10, 10, 10, 10, 20, 20, 20, 20, 20, 20];
    const ema = calculateEma(candlesFromCloses(closes), 4);
    expect(ema).toHaveLength(closes.length);
    expect(ema[3]).toBe(10);
    // k = 0.4: 20*0.4 + 10*0.6 = 14, then 16.4, 17.84, 18.704, 19.2224, 19.53344
    expect(ema[4]).toBeCloseTo(14, 10);
    expect(ema[9]).toBeCloseTo(19.53344, 10);
    expect(ema[9]!).toBeLessThan(20);
  });
});
