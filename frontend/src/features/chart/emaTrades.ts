// EMA cross trades overlay (spec 039): parameters chosen in Settings > Display.
export interface EmaTradesSettings {
  fast: number;
  slow: number;
  entryPips: number;
  hours: number;
  count: number;
}

export const DEFAULT_EMA_TRADES: EmaTradesSettings = { fast: 24, slow: 48, entryPips: 5, hours: 24, count: 3 };

export const EMA_TRADES_LIMITS = {
  hours: { min: 1, max: 720 },
  count: { min: 1, max: 10 },
} as const;
