import { db } from '../db/client';
import type { BridgeCandles } from '../bridge/file-watcher';
import { chunks } from './chunk';

export async function upsertCandles(
  broker: string,
  symbol: string,
  timeframe: string,
  data: BridgeCandles,
) {
  // The last bar is still forming; only closed bars are stored.
  const closed = data.candles.slice(0, -1);

  for (const batch of chunks(closed)) {
    await db.candle.createMany({
      data: batch.map((c) => ({
        broker,
        symbol,
        timeframe,
        time: new Date(c.time * 1000),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
      skipDuplicates: true,
    });
  }
}
