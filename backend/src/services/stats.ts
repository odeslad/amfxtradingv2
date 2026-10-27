import { db } from '../db/client';
import { computeStats, type BrokerStats, type Movement } from './stats-core';

export type { BrokerStats, MonthlyStats, CurvePoint, BalanceOperationSummary } from './stats-core';

export interface StatsResponse extends BrokerStats {
  symbol: string | null;
  // Every symbol ever traded on the broker, for the asset filter (spec 029).
  symbols: string[];
}

// With a symbol only that asset's trades are loaded; balance operations belong to no asset.
async function loadMovements(broker: string, since?: Date, symbol?: string): Promise<{ trades: Movement[]; operations: Movement[] }> {
  const timeFilter = since ? { gte: since } : undefined;
  const [tradeRows, opRows] = await Promise.all([
    db.trade.findMany({
      where: { broker, ...(symbol ? { symbol } : {}), ...(timeFilter ? { closeTime: timeFilter } : {}) },
      select: { profit: true, swap: true, commission: true, closeTime: true },
      orderBy: { closeTime: 'asc' },
    }),
    symbol
      ? Promise.resolve([])
      : db.balanceOperation.findMany({
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

async function tradedSymbols(broker: string): Promise<string[]> {
  const rows = await db.trade.findMany({ where: { broker }, distinct: ['symbol'], select: { symbol: true } });
  return rows.map(r => r.symbol).sort();
}

// DB adapter: loads the anchor balance and the movements, the maths live in stats-core.
export async function computeBrokerStats(broker: string, from?: Date, to?: Date, symbol?: string): Promise<StatsResponse> {
  const [latest, movements, symbols] = await Promise.all([
    db.balance.findFirst({
      where: { broker },
      orderBy: { timestamp: 'desc' },
      select: { balance: true, currency: true, timestamp: true },
    }),
    loadMovements(broker, from, symbol),
    tradedSymbols(broker),
  ]);
  const stats = computeStats({ broker, latest, ...movements, from, to, mode: symbol ? 'asset' : 'account' });
  return { ...stats, symbol: symbol ?? null, symbols };
}
