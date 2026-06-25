import type { Candle } from '../../indicators/ema';
import type { EntryConfig } from '../entry-evaluator';

export function findActivation(
  candles: Candle[],
  entry: EntryConfig,
  direction: 'buy' | 'sell',
  windowStartIndex: number,
  windowEnd: number,
  entryPrice: number,
): number | null {
  if (entry.type === 'ECC' && entry.offset === 0 && entry.windowStart === 0 && entry.windowEnd === 0) {
    return windowStartIndex;
  }

  for (let i = windowStartIndex; i <= windowEnd; i++) {
    const touched = direction === 'buy'
      ? candles[i].low <= entryPrice
      : candles[i].high >= entryPrice;
    if (touched) return i;
  }

  return null;
}

export function resolveScanParams(
  candles: Candle[],
  entry: EntryConfig,
  activationCandleIndex: number,
): { scanFrom: number; entryTime: Date } {
  const isEntryAtClose = entry.type === 'ECC' && entry.offset === 0 && entry.windowStart === 0 && entry.windowEnd === 0;
  return {
    scanFrom: isEntryAtClose ? activationCandleIndex + 1 : activationCandleIndex,
    entryTime: isEntryAtClose
      ? (candles[activationCandleIndex + 1]?.time ?? candles[activationCandleIndex].time)
      : candles[activationCandleIndex].time,
  };
}
