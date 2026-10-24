import { db } from '../db/client';
import type { TickBatch, TickData } from '../bridge/pipe-reader';

// A closed candle rebuilt from the last tick of the previous bar (spec 025): the EA's
// candle file only reaches the DB a poll later, this one lands at the rollover.
export interface ClosedCandle {
  symbol: string;
  timeframe: string;
  time: number;   // ms, broker-time base shared with candles.time
  open: number;
  high: number;
  low: number;
  close: number;  // last bid before the rollover
}

interface Snapshot {
  time: number;
  open: number;
  high: number;
  low: number;
  bid: number;
}

const TF_FIELDS = [
  { tf: 'M5', time: 'm5_time', open: 'm5_open', high: 'm5_high', low: 'm5_low' },
  { tf: 'M15', time: 'm15_time', open: 'm15_open', high: 'm15_high', low: 'm15_low' },
  { tf: 'H1', time: 'h1_time', open: 'h1_open', high: 'h1_high', low: 'h1_low' },
  { tf: 'H4', time: 'h4_time', open: 'h4_open', high: 'h4_high', low: 'h4_low' },
  { tf: 'D1', time: 'd1_time', open: 'd1_open', high: 'd1_high', low: 'd1_low' },
] as const satisfies ReadonlyArray<{ tf: string; time: keyof TickData; open: keyof TickData; high: keyof TickData; low: keyof TickData }>;

export type CandleCloseState = Map<string, Snapshot>;

export const createCandleCloseState = (): CandleCloseState => new Map();

// Pure: feeds a batch into the state and returns the candles that closed in it.
// The first tick of a key only seeds the snapshot; a candle needs a full previous bar.
export function trackCandleCloses(state: CandleCloseState, broker: string, batch: TickBatch): ClosedCandle[] {
  const closed: ClosedCandle[] = [];
  for (const tick of batch) {
    for (const f of TF_FIELDS) {
      const time = tick[f.time];
      if (!Number.isFinite(time)) continue;
      const key = `${broker}:${tick.symbol}:${f.tf}`;
      const prev = state.get(key);
      if (prev && prev.time !== time) {
        closed.push({ symbol: tick.symbol, timeframe: f.tf, time: prev.time, open: prev.open, high: prev.high, low: prev.low, close: prev.bid });
      }
      state.set(key, { time, open: tick[f.open], high: tick[f.high], low: tick[f.low], bid: tick.bid });
    }
  }
  return closed;
}

// Stores the candle unless the EA already wrote that row (the file keeps authority).
export async function persistClosedCandle(broker: string, c: ClosedCandle): Promise<void> {
  const time = new Date(c.time);
  await db.candle.upsert({
    where: { broker_symbol_timeframe_time: { broker, symbol: c.symbol, timeframe: c.timeframe, time } },
    update: {},
    create: { broker, symbol: c.symbol, timeframe: c.timeframe, time, open: c.open, high: c.high, low: c.low, close: c.close },
  });
}
