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
  // ECC with no offset and a zero window means "enter at market on the candle
  // right after the setup", without waiting for a level touch.
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
  _entry: EntryConfig,
  activationCandleIndex: number,
  tfMs: number,
): { scanFrom: number; entryTime: Date } {
  // The entry triggers intrabar on activationCandleIndex (the candle that
  // touched the level). Candle `time` in the DB is the candle CLOSE, but the
  // touch happens inside the candle, so the entry time is the candle's OPEN =
  // close − one timeframe.
  const closeTime = candles[activationCandleIndex].time;
  return {
    scanFrom: activationCandleIndex,
    entryTime: new Date(closeTime.getTime() - tfMs),
  };
}
