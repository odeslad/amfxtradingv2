import { db } from '../db/client';
import type { BridgeTrade } from '../bridge/file-watcher';

export async function syncTrades(broker: string, trades: BridgeTrade[]) {
  for (const t of trades) {
    await db.trade.upsert({
      where: { ticket: t.ticket },
      update: {},
      create: {
        ticket: t.ticket, broker, symbol: t.symbol,
        type: t.type, lots: t.lots, openPrice: t.openPrice,
        closePrice: t.closePrice, sl: t.sl, tp: t.tp,
        profit: t.profit, swap: t.swap, commission: t.commission,
        magic: t.magic, comment: t.comment,
        openTime: new Date(t.openTime), closeTime: new Date(t.closeTime),
      },
    });
  }
}
