import { db } from '../db/client';
import type { BridgeCandles } from '../bridge/file-watcher';

export async function upsertCandles(
  broker: string,
  symbol: string,
  timeframe: string,
  data: BridgeCandles,
) {
  const records = data.candles.map((c) => ({
    broker,
    symbol,
    timeframe,
    time: new Date(c.time * 1000),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));

  for (const record of records) {
    await db.candle.upsert({
      where: { broker_symbol_timeframe_time: { broker: record.broker, symbol: record.symbol, timeframe: record.timeframe, time: record.time } },
      update: { open: record.open, high: record.high, low: record.low, close: record.close },
      create: record,
    });
  }
}
