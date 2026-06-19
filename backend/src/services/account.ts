import { db } from '../db/client';
import type { BridgeAccount } from '../bridge/file-watcher';

export async function saveDailyBalances(broker: string, account: BridgeAccount) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await db.balance.findFirst({
    where: { broker, timestamp: { gte: today } },
  });

  const data = {
    broker,
    balance: account.balance, equity: account.equity,
    profit: account.profit, margin: account.margin,
    freeMargin: account.freeMargin, leverage: account.leverage,
    currency: account.currency, name: account.name,
    number: account.number,
  };

  if (existing) {
    await db.balance.update({ where: { id: existing.id }, data });
  } else {
    await db.balance.create({ data });
  }
}
