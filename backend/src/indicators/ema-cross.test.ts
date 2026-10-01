import { describe, it, expect } from 'vitest';
import { calculateEma, type Candle } from './ema';
import { detectEmaCrossSetups } from './ema-cross';

// Characterisation tests: they pin what the detector does today on a synthetic
// V-shaped series (down, then up), so later refactors cannot move a cross or a
// level without this file noticing.

const candlesFromCloses = (closes: number[]): Candle[] =>
  closes.map((close, i) => ({
    time: new Date(Date.UTC(2026, 0, 1, i)),
    open: close, high: close + 0.0005, low: close - 0.0005, close,
  }));

// 30 bars falling 10 pips each, then 30 bars rising 10 pips each.
const vShape = [
  ...Array.from({ length: 30 }, (_, i) => 1.2000 - i * 0.0010),
  ...Array.from({ length: 30 }, (_, i) => 1.1710 + i * 0.0010),
];
const candles = candlesFromCloses(vShape);
const context = { emaFast: 5, emaSlow: 20, direction: 'both' as const };

describe('detectEmaCrossSetups', () => {
  it('finds exactly one bullish cross after the turn and none before', () => {
    const setups = detectEmaCrossSetups(candles, context);
    expect(setups.map(s => s.direction)).toEqual(['buy']);
  });

  it('activates on the first bar where the fast EMA closes above the slow EMA', () => {
    const [setup] = detectEmaCrossSetups(candles, context);
    const fast = calculateEma(candles, 5);
    const slow = calculateEma(candles, 20);
    const i = setup.activationIndex;
    expect(fast[i - 1]! <= slow[i - 1]!).toBe(true);
    expect(fast[i]! > slow[i]!).toBe(true);
    expect(i).toBeGreaterThan(30);
    expect(setup.activationTime).toEqual(candles[i].time);
  });

  it('levels: ECC is the activation close and EMA sits between the two EMAs at the cross', () => {
    const [setup] = detectEmaCrossSetups(candles, context);
    const fast = calculateEma(candles, 5);
    const slow = calculateEma(candles, 20);
    const i = setup.activationIndex;
    expect(setup.levels.ECC).toBe(candles[i].close);
    const lo = Math.min(fast[i - 1]!, slow[i - 1]!, fast[i]!, slow[i]!);
    const hi = Math.max(fast[i - 1]!, slow[i - 1]!, fast[i]!, slow[i]!);
    expect(setup.levels.EMA).toBeGreaterThanOrEqual(lo);
    expect(setup.levels.EMA).toBeLessThanOrEqual(hi);
  });

  it('EVL is the lowest fast EMA before the bullish cross; MHL is null without a previous opposite cross', () => {
    const [setup] = detectEmaCrossSetups(candles, context);
    const fast = calculateEma(candles, 5);
    const minFast = Math.min(...fast.slice(0, setup.activationIndex + 1).filter((v): v is number => v !== null));
    expect(setup.levels.EVL).toBeCloseTo(minFast, 10);
    expect(setup.levels.MHL).toBeNull();
  });

  it('a mirrored series yields exactly one bearish cross with the same activation index', () => {
    const mirrored = candlesFromCloses(vShape.map(c => 2.4 - c));
    const [buy] = detectEmaCrossSetups(candles, context);
    const setups = detectEmaCrossSetups(mirrored, context);
    expect(setups.map(s => s.direction)).toEqual(['sell']);
    expect(setups[0].activationIndex).toBe(buy.activationIndex);
  });

  it('honours the requested direction', () => {
    expect(detectEmaCrossSetups(candles, { ...context, direction: 'sell' })).toEqual([]);
    expect(detectEmaCrossSetups(candles, { ...context, direction: 'buy' })).toHaveLength(1);
  });

  it('a setup still open at the end of the series has no close and counts the remaining bars', () => {
    const [setup] = detectEmaCrossSetups(candles, context);
    expect(setup.closeIndex).toBeNull();
    expect(setup.candleCount).toBe(candles.length - 1 - setup.activationIndex);
  });
});
