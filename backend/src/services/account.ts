import { db } from '../db/client';
import type { BridgeAccount } from '../bridge/file-watcher';

const utcDay = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

// One row per broker and UTC day, enforced by the (broker, day) unique key: a
// single upsert cannot race with itself, and `timestamp` always marks the last
// write so stats can use it as the balance anchor.
export async function saveDailyBalances(broker: string, account: BridgeAccount) {
  const now = new Date();
  const day = utcDay(now);

  const data = {
    balance: account.balance, equity: account.equity,
    profit: account.profit, margin: account.margin,
    freeMargin: account.freeMargin, leverage: account.leverage,
    currency: account.currency, name: account.name,
    number: account.number,
    timestamp: now,
  };

  await db.balance.upsert({
    where: { broker_day: { broker, day } },
    create: { broker, day, ...data },
    update: data,
  });
}
