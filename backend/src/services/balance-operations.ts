import { db } from '../db/client';
import type { BridgeTrade } from '../bridge/file-watcher';

export const BALANCE_OPERATION_TYPES = new Set([6, 7]);

export async function syncBalanceOperations(broker: string, entries: BridgeTrade[]) {
  for (const e of entries) {
    await db.balanceOperation.upsert({
      where: { ticket: e.ticket },
      update: {},
      create: {
        ticket: e.ticket, broker, type: e.type,
        amount: e.profit, comment: e.comment,
        time: new Date(e.closeTime),
      },
    });
  }
}
