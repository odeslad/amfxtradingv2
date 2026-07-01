import type { Candle } from '../../indicators/ema';
import type { PivotPoint } from '../ema-cross';
import { applyTrailing, type TrailConfig } from './trail';

export interface SlStep {
  time: Date; // candle OPEN time (close − one timeframe), same as entry/exit
  sl: number;
}

export interface ScanResult {
  exitTime: Date | null;
  exitPrice: number | null;
  resultPips: number | null;
  status: 'open' | 'closed';
  reason: 'SL' | 'TP' | null;
  // Every SL value over the trade's life: the initial SL plus each trailing move.
  // Lets the chart draw the SL as a step line showing WHEN the trailing acted,
  // independent of whether price ever reached the SL. Debugging aid.
  slHistory: SlStep[];
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
  tfMs: number,
  trail: TrailConfig,
  weakCandles: Date[],
  strongCandles: Date[],
  pivots: PivotPoint[],
): ScanResult {
  let currentSl = slPrice;
  const updateEvery = Math.max(1, trail.updateEvery);

  // SL/TP are hit intrabar, so the exit time is the candle's OPEN (close − one
  // timeframe), not the stored close — same convention as the entry time.
  const openTime = (candle: Candle) => new Date(candle.time.getTime() - tfMs);

  // Record the initial SL, then each time the trailing actually moves it.
  const slHistory: SlStep[] = [{ time: openTime(candles[fromIndex]), sl: currentSl }];

  for (let i = fromIndex; i <= toIndex; i++) {
    if (trail.type !== 'none' && i > fromIndex && (i - fromIndex) % updateEvery === 0) {
      const movedSl = applyTrailing(candles, i, fromIndex, direction, entryPrice, currentSl, trail, pipSize, weakCandles, strongCandles, pivots);
      if (movedSl !== currentSl) {
        currentSl = movedSl;
        slHistory.push({ time: openTime(candles[i]), sl: currentSl });
      }
    }

    const candle = candles[i];

    if (direction === 'buy') {
      if (candle.low <= currentSl) {
        return { status: 'closed', reason: 'SL', exitTime: openTime(candle), exitPrice: currentSl, resultPips: (currentSl - entryPrice) / pipSize, slHistory };
      }
      if (tpPrice !== null && candle.high >= tpPrice) {
        return { status: 'closed', reason: 'TP', exitTime: openTime(candle), exitPrice: tpPrice, resultPips: (tpPrice - entryPrice) / pipSize, slHistory };
      }
    } else {
      if (candle.high >= currentSl) {
        return { status: 'closed', reason: 'SL', exitTime: openTime(candle), exitPrice: currentSl, resultPips: (entryPrice - currentSl) / pipSize, slHistory };
      }
      if (tpPrice !== null && candle.low <= tpPrice) {
        return { status: 'closed', reason: 'TP', exitTime: openTime(candle), exitPrice: tpPrice, resultPips: (entryPrice - tpPrice) / pipSize, slHistory };
      }
    }
  }

  return { status: 'open', reason: null, exitTime: null, exitPrice: null, resultPips: null, slHistory };
}
