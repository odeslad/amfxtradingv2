import { db } from '../db/client';
import type { BridgeAccount } from '../bridge/file-watcher';

export async function saveAccountSnapshot(broker: string, account: BridgeAccount) {
  await db.accountSnapshot.create({
    data: {
      broker,
      balance: account.balance, equity: account.equity,
      profit: account.profit, margin: account.margin,
      freeMargin: account.freeMargin, leverage: account.leverage,
      currency: account.currency, name: account.name,
      number: account.number,
    },
  });
}
