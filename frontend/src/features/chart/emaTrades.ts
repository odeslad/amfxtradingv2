// EMA cross trades overlay (spec 039): parameters chosen in Settings > Display.
export interface EmaTradesSettings {
  fast: number;
  slow: number;
  entryPips: number;
  candles: number;
  count: number;
}

export const DEFAULT_EMA_TRADES: EmaTradesSettings = { fast: 24, slow: 48, entryPips: 5, candles: 24, count: 3 };

export const EMA_TRADES_LIMITS = {
  candles: { min: 1, max: 50 },
  count: { min: 1, max: 10 },
} as const;
