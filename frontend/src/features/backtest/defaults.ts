import type { EntryConfig, EntryType, StrategyForm } from './backtest.types';

export const ENTRY_TYPES: EntryType[] = ['ECC', 'EMA', 'EVL', 'MHL'];

export function defaultEntry(type: EntryType = 'ECC'): EntryConfig {
  return {
    type,
    enabled: true,
    invert: false,
    offset: 0,
    windowStart: 0,
    windowEnd: 10,
    sl: { type: 'fixed', pips: 20, minPips: null, maxPips: null, evlOffset: 0 },
    exit: { type: 'rr', pips: null, rr: 2 },
    trail: {
      type: 'none',
      level: 'extreme',
      offset: 0,
      distance: 0,
      updateEvery: 1,
      toRR: null,
      activateCandles: null,
      activateMode: 'or',
    },
  };
}

export function normalizeForm(form: Partial<StrategyForm> | undefined): StrategyForm {
  const base = defaultForm();
  if (!form) return base;
  return {
    ...base,
    ...form,
    setup: { ...base.setup, ...form.setup },
    entries: form.entries?.length
      ? form.entries.map(e => {
          const d = defaultEntry(e.type);
          return { ...d, ...e, sl: { ...d.sl, ...e.sl }, exit: { ...d.exit, ...e.exit }, trail: { ...d.trail, ...e.trail } };
        })
      : base.entries,
  };
}

export function defaultForm(): StrategyForm {
  return {
    id: crypto.randomUUID(),
    name: 'New setup',
    instrument: 'EURUSD',
    timeframe: 'H1',
    setup: {
      type: 'ema_cross',
      emaFast: 12,
      emaSlow: 26,
      direction: 'both',
      pivotLen: 5,
      weakConfig: { enabled: true, maxSpreadPips: 10, useMaxSpread: true },
      strongConfig: { enabled: true, minSpreadPips: 2, useMinSpread: true },
    },
    entries: [defaultEntry()],
  };
}
