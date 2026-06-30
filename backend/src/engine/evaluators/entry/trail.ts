import type { Candle } from '../../indicators/ema';
import type { PivotPoint } from '../ema-cross';

export interface TrailConfig {
  type: 'none' | 'weak' | 'pivot' | 'fixed';
  level: 'extreme' | 'close';
  offset: number;
  distance: number;
  updateEvery: number;
  toRR: number | null;
  activateCandles: number | null;
  activateMode: 'and' | 'or';
}

export function applyTrailing(
  candles: Candle[],
  currentIndex: number,
  entryIndex: number,
  direction: 'buy' | 'sell',
  entryPrice: number,
  currentSl: number,
  trail: TrailConfig,
  pipSize: number,
  weakCandles: Date[],
  strongCandles: Date[],
  pivots: PivotPoint[],
): number {
  const candlesElapsed = currentIndex - entryIndex;
  const slDistancePips = Math.abs(entryPrice - currentSl) / pipSize;
  const currentProfitPips = direction === 'buy'
    ? (candles[currentIndex].close - entryPrice) / pipSize
    : (entryPrice - candles[currentIndex].close) / pipSize;
  const currentRR = slDistancePips > 0 ? currentProfitPips / slDistancePips : 0;

  const candlesOk = trail.activateCandles === null || candlesElapsed >= trail.activateCandles;
  const rrOk = trail.toRR === null || currentRR >= trail.toRR;
  const activated = trail.activateMode === 'and' ? candlesOk && rrOk : candlesOk || rrOk;

  if (!activated) return currentSl;

  let newSl: number | null = null;

  if (trail.type === 'fixed') {
    newSl = direction === 'buy'
      ? candles[currentIndex].close - trail.distance * pipSize
      : candles[currentIndex].close + trail.distance * pipSize;
  }

  if (trail.type === 'weak') {
    const relevantDates = direction === 'buy' ? weakCandles : strongCandles;
    const relevantSet = new Set(relevantDates.map(d => d.getTime()));
    let bestSl: number | null = null;

    for (let i = currentIndex; i >= entryIndex; i--) {
      if (!relevantSet.has(candles[i].time.getTime())) continue;

      const basePrice = trail.level === 'close'
        ? candles[i].close
        : (direction === 'buy' ? candles[i].low : candles[i].high);

      // Negative offset moves the SL against the trade direction (buy → down,
      // sell → up), matching the entry / SL offset convention.
      const level = direction === 'buy'
        ? basePrice + trail.offset * pipSize
        : basePrice - trail.offset * pipSize;

      if (direction === 'buy' && level > currentSl) {
        if (bestSl === null || level < bestSl) bestSl = level;
      } else if (direction === 'sell' && level < currentSl) {
        if (bestSl === null || level > bestSl) bestSl = level;
      }
    }

    newSl = bestSl;
  }

  if (trail.type === 'pivot') {
    const pivotType = direction === 'buy' ? 'low' : 'high';
    const confirmType: PivotPoint['type'] = direction === 'buy' ? 'high' : 'low';

    const timeToIndex = new Map<number, number>();
    for (let i = 0; i <= currentIndex; i++) {
      timeToIndex.set(candles[i].time.getTime(), i);
    }

    const validPivots = pivots.filter(p => {
      const idx = timeToIndex.get(p.time.getTime());
      return p.type === pivotType && idx !== undefined && idx <= currentIndex;
    });

    for (let pi = validPivots.length - 1; pi >= 0; pi--) {
      const piv = validPivots[pi];
      const hasConfirmation = pivots.some(p => p.type === confirmType && p.time.getTime() > piv.time.getTime());
      if (!hasConfirmation) continue;

      newSl = direction === 'buy'
        ? piv.price + trail.offset * pipSize
        : piv.price - trail.offset * pipSize;
      break;
    }
  }

  if (newSl === null) return currentSl;

  if (direction === 'buy' && newSl > currentSl) return newSl;
  if (direction === 'sell' && newSl < currentSl) return newSl;
  return currentSl;
}
