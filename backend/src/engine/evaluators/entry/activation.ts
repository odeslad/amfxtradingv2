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
): { scanFrom: number; entryTime: Date } {
  // The entry triggers on activationCandleIndex (the candle that touched the
  // level, or the market-entry candle for the zero-window ECC case). Both the
  // entry time and the SL/TP scan start from that same candle.
  return {
    scanFrom: activationCandleIndex,
    entryTime: candles[activationCandleIndex].time,
  };
}
