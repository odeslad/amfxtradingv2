import { db } from '../db/client';
import type { BridgeTrade } from '../bridge/file-watcher';
import { chunks } from './chunk';

export const BALANCE_OPERATION_TYPES = new Set([6, 7]);

// Insert-only, keyed by ticket like trades.
export async function syncBalanceOperations(broker: string, entries: BridgeTrade[]) {
  for (const batch of chunks(entries)) {
    await db.balanceOperation.createMany({
      data: batch.map(e => ({
        ticket: e.ticket, broker, type: e.type,
        amount: e.profit, comment: e.comment,
        time: new Date(e.closeTime),
      })),
      skipDuplicates: true,
    });
  }
}
