import { db } from '../db/client';

export type StartBalanceSource = 'snapshot' | 'derived' | 'none';

export interface MonthlyStats {
  month: string;
  trades: number;
  netPnl: number;
}

export interface BrokerStats {
  broker: string;
  currency: string;
  period: { from: string | null; to: string | null; months: number };
  trades: number;
  wins: number;
  losses: number;
  netPnl: number;
  tradesPerMonth: number;
  startBalance: number | null;
  startBalanceSource: StartBalanceSource;
  returnPct: number | null;
  monthly: MonthlyStats[];
}

interface TradeNet {
  net: number;
  closeTime: Date;
}

const monthKey = (date: Date): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

const monthsBetween = (start: Date, end: Date): number =>
  (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) + 1;

const buildMonthly = (start: Date, months: number, trades: TradeNet[]): MonthlyStats[] => {
  const byMonth = new Map<string, MonthlyStats>();
  for (let i = 0; i < months; i++) {
    const month = monthKey(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)));
    byMonth.set(month, { month, trades: 0, netPnl: 0 });
  }
  for (const t of trades) {
    const bucket = byMonth.get(monthKey(t.closeTime));
    if (!bucket) continue;
    bucket.trades += 1;
    bucket.netPnl += t.net;
  }
  return [...byMonth.values()];
};

const sumNet = (trades: TradeNet[]): number => trades.reduce((sum, t) => sum + t.net, 0);

async function loadTrades(broker: string, from?: Date, to?: Date): Promise<TradeNet[]> {
  const rows = await db.trade.findMany({
    where: {
      broker,
      ...(from || to ? { closeTime: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    },
    select: { profit: true, swap: true, commission: true, closeTime: true },
    orderBy: { closeTime: 'asc' },
  });
  return rows.map(r => ({ net: r.profit + r.swap + r.commission, closeTime: r.closeTime }));
}

async function resolveStartBalance(
  broker: string,
  periodStart: Date | null,
  hasFrom: boolean,
  tradesSinceStart: TradeNet[],
): Promise<{ startBalance: number | null; source: StartBalanceSource }> {
  if (hasFrom && periodStart) {
    const snapshot = await db.balance.findFirst({
      where: { broker, timestamp: { lte: periodStart } },
      orderBy: { timestamp: 'desc' },
      select: { balance: true },
    });
    if (snapshot) return { startBalance: snapshot.balance, source: 'snapshot' };
  }

  const latest = await db.balance.findFirst({
    where: { broker },
    orderBy: { timestamp: 'desc' },
    select: { balance: true },
  });
  if (!latest) return { startBalance: null, source: 'none' };

  return { startBalance: latest.balance - sumNet(tradesSinceStart), source: 'derived' };
}

export async function computeBrokerStats(broker: string, from?: Date, to?: Date): Promise<BrokerStats> {
  const [trades, latest] = await Promise.all([
    loadTrades(broker, from, to),
    db.balance.findFirst({ where: { broker }, orderBy: { timestamp: 'desc' }, select: { currency: true } }),
  ]);

  const periodStart = from ?? trades[0]?.closeTime ?? null;
  const periodEnd = to ?? new Date();
  const months = periodStart ? monthsBetween(periodStart, periodEnd) : 0;

  const netPnl = sumNet(trades);
  const wins = trades.filter(t => t.net > 0).length;
  const losses = trades.filter(t => t.net < 0).length;

  const tradesSinceStart = to && periodStart ? await loadTrades(broker, periodStart) : trades;
  const { startBalance, source } = await resolveStartBalance(broker, periodStart, !!from, tradesSinceStart);

  return {
    broker,
    currency: latest?.currency ?? '',
    period: { from: periodStart?.toISOString() ?? null, to: to?.toISOString() ?? null, months },
    trades: trades.length,
    wins,
    losses,
    netPnl,
    tradesPerMonth: months > 0 ? trades.length / months : 0,
    startBalance,
    startBalanceSource: source,
    returnPct: startBalance ? (netPnl / startBalance) * 100 : null,
    monthly: periodStart ? buildMonthly(periodStart, months, trades) : [],
  };
}
