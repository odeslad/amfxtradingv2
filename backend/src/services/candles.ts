import { db } from '../db/client';
import type { BridgeCandles } from '../bridge/file-watcher';

const CHUNK_SIZE = 5_000;

export async function upsertCandles(
  broker: string,
  symbol: string,
  timeframe: string,
  data: BridgeCandles,
) {
  const closed = data.candles.slice(0, -1);

  // Insert in chunks so Prisma never serializes the full history in one query.
  for (let i = 0; i < closed.length; i += CHUNK_SIZE) {
    const records = closed.slice(i, i + CHUNK_SIZE).map((c) => ({
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
}
