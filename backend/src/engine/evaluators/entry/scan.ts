import type { Candle } from '../../indicators/ema';
import type { PivotPoint } from '../ema-cross';
import { applyTrailing, type TrailConfig } from './trail';

export interface ScanResult {
  exitTime: Date | null;
  exitPrice: number | null;
  resultPips: number | null;
  status: 'open' | 'closed';
  reason: 'SL' | 'TP' | null;
}

export function scanResult(
  candles: Candle[],
  fromIndex: number,
  toIndex: number,
  direction: 'buy' | 'sell',
  entryPrice: number,
  slPrice: number,
  tpPrice: number | null,
  pipSize: number,
  trail: TrailConfig,
  weakCandles: Date[],
  strongCandles: Date[],
  pivots: PivotPoint[],
): ScanResult {
  let currentSl = slPrice;
  const updateEvery = Math.max(1, trail.updateEvery);

  for (let i = fromIndex; i <= toIndex; i++) {
    if (trail.type !== 'none' && i > fromIndex && (i - fromIndex) % updateEvery === 0) {
      currentSl = applyTrailing(candles, i, fromIndex, direction, entryPrice, currentSl, trail, pipSize, weakCandles, strongCandles, pivots);
    }

    const candle = candles[i];

    if (direction === 'buy') {
      if (candle.low <= currentSl) {
        return { status: 'closed', reason: 'SL', exitTime: candle.time, exitPrice: currentSl, resultPips: (currentSl - entryPrice) / pipSize };
      }
      if (tpPrice !== null && candle.high >= tpPrice) {
        return { status: 'closed', reason: 'TP', exitTime: candle.time, exitPrice: tpPrice, resultPips: (tpPrice - entryPrice) / pipSize };
      }
    } else {
      if (candle.high >= currentSl) {
        return { status: 'closed', reason: 'SL', exitTime: candle.time, exitPrice: currentSl, resultPips: (entryPrice - currentSl) / pipSize };
      }
      if (tpPrice !== null && candle.low <= tpPrice) {
        return { status: 'closed', reason: 'TP', exitTime: candle.time, exitPrice: tpPrice, resultPips: (entryPrice - tpPrice) / pipSize };
      }
    }
  }

  return { status: 'open', reason: null, exitTime: null, exitPrice: null, resultPips: null };
}
