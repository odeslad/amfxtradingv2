import { db } from '../db/client';
import type { BridgeCandles } from '../bridge/file-watcher';

export async function upsertCandles(
  broker: string,
  symbol: string,
  timeframe: string,
  data: BridgeCandles,
) {
  const closed = data.candles.slice(0, -1);

  const records = closed.map((c) => ({
    broker,
    symbol,
    timeframe,
    time: new Date(c.time * 1000),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));

  await db.candle.createMany({ data: records, skipDuplicates: true });
}
