import { db } from '../db/client';
import type { BridgeTrade } from '../bridge/file-watcher';
import { chunks } from './chunk';

// Insert-only: a ticket already stored is never rewritten (closed trades do not change).
export async function syncTrades(broker: string, trades: BridgeTrade[]) {
  for (const batch of chunks(trades)) {
    await db.trade.createMany({
      data: batch.map(t => ({
        ticket: t.ticket, broker, symbol: t.symbol,
        type: t.type, lots: t.lots, openPrice: t.openPrice,
        closePrice: t.closePrice, sl: t.sl, tp: t.tp,
        profit: t.profit, swap: t.swap, commission: t.commission,
        magic: t.magic, comment: t.comment,
        openTime: new Date(t.openTime), closeTime: new Date(t.closeTime),
      })),
      skipDuplicates: true,
    });
  }
}
