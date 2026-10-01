import { db } from '../db/client';
import { computeStats, type BrokerStats, type Movement } from './stats-core';

export type { BrokerStats, MonthlyStats, CurvePoint, BalanceOperationSummary } from './stats-core';

async function loadMovements(broker: string, since?: Date): Promise<{ trades: Movement[]; operations: Movement[] }> {
  const timeFilter = since ? { gte: since } : undefined;
  const [tradeRows, opRows] = await Promise.all([
    db.trade.findMany({
      where: { broker, ...(timeFilter ? { closeTime: timeFilter } : {}) },
      select: { profit: true, swap: true, commission: true, closeTime: true },
      orderBy: { closeTime: 'asc' },
    }),
    db.balanceOperation.findMany({
      where: { broker, ...(timeFilter ? { time: timeFilter } : {}) },
      select: { amount: true, comment: true, time: true },
      orderBy: { time: 'asc' },
    }),
  ]);
  return {
    trades: tradeRows.map(r => ({ amount: r.profit + r.swap + r.commission, time: r.closeTime })),
    operations: opRows.map(r => ({ amount: r.amount, time: r.time, comment: r.comment })),
  };
}

// DB adapter: loads the anchor balance and the movements, the maths live in stats-core.
export async function computeBrokerStats(broker: string, from?: Date, to?: Date): Promise<BrokerStats> {
  const [latest, movements] = await Promise.all([
    db.balance.findFirst({
      where: { broker },
      orderBy: { timestamp: 'desc' },
      select: { balance: true, currency: true, timestamp: true },
    }),
    loadMovements(broker, from),
  ]);
  return computeStats({ broker, latest, ...movements, from, to });
}
