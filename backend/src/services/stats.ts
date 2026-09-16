import { db } from '../db/client';

export interface MonthlyStats {
  month: string;
  trades: number;
  netPnl: number;
  cashFlow: number;
  returnPct: number | null;
}

export interface CurvePoint {
  date: string;
  balance: number;
}

export interface BalanceOperationSummary {
  time: string;
  amount: number;
  comment: string;
}

export interface BrokerStats {
  broker: string;
  currency: string;
  period: { from: string | null; to: string | null; months: number };
  trades: number;
  wins: number;
  losses: number;
  netPnl: number;
  cashFlow: number;
  tradesPerMonth: number;
  startBalance: number | null;
  returnPct: number | null;
  monthly: MonthlyStats[];
  curve: CurvePoint[];
  operations: BalanceOperationSummary[];
}

interface Movement {
  amount: number;
  time: Date;
  comment?: string;
}

const DAY_MS = 86_400_000;

const monthKey = (date: Date): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

const dayKey = (date: Date): string => date.toISOString().slice(0, 10);

const startOfUtcMonth = (date: Date): Date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const startOfUtcDay = (date: Date): Date => new Date(Math.floor(date.getTime() / DAY_MS) * DAY_MS);

const monthsBetween = (start: Date, end: Date): number =>
  (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) + 1;

const sum = (items: Movement[]): number => items.reduce((acc, m) => acc + m.amount, 0);

const returnPct = (pnl: number, startBalance: number, cashFlow: number): number | null => {
  const denominator = startBalance + cashFlow;
  return denominator > 0 ? (pnl / denominator) * 100 : null;
};

// Amount of movements strictly after `t`, via a suffix sum over the list sorted ascending by time.
const afterSum = (sorted: Movement[], suffix: number[]) => (t: Date): number => {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].time.getTime() > t.getTime()) hi = mid;
    else lo = mid + 1;
  }
  return suffix[lo];
};

const suffixSums = (sorted: Movement[]): number[] => {
  const suffix = new Array<number>(sorted.length + 1).fill(0);
  for (let i = sorted.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + sorted[i].amount;
  return suffix;
};

const inWindow = (items: Movement[], from: Date, to: Date): Movement[] =>
  items.filter(m => m.time >= from && m.time <= to);

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

export async function computeBrokerStats(broker: string, from?: Date, to?: Date): Promise<BrokerStats> {
  const [latest, all] = await Promise.all([
    db.balance.findFirst({
      where: { broker },
      orderBy: { timestamp: 'desc' },
      select: { balance: true, currency: true, timestamp: true },
    }),
    loadMovements(broker, from),
  ]);

  const now = new Date();
  const periodEnd = to ?? now;
  const periodTrades = to ? all.trades.filter(t => t.time <= periodEnd) : all.trades;
  const periodStart = from ?? periodTrades[0]?.time ?? null;
  const periodOps = periodStart ? inWindow(all.operations, periodStart, periodEnd) : [];

  const tradesAfter = afterSum(all.trades, suffixSums(all.trades));
  const opsAfter = afterSum(all.operations, suffixSums(all.operations));
  const anchor = latest?.balance ?? 0;
  // Balance once every movement at or before `t` has been applied.
  const balanceAt = (t: Date): number => {
    if (latest && t >= latest.timestamp) return anchor;
    return anchor - tradesAfter(t) - opsAfter(t);
  };
  // Balance before any movement at `t` itself: what the account held when the window opened.
  const balanceBefore = (t: Date): number => balanceAt(new Date(t.getTime() - 1));

  const netPnl = sum(periodTrades);
  const cashFlow = sum(periodOps);
  const startBalance = periodStart ? balanceBefore(periodStart) : anchor;
  const months = periodStart ? monthsBetween(periodStart, periodEnd) : 0;

  const monthly: MonthlyStats[] = [];
  if (periodStart) {
    const byMonth = new Map<string, MonthlyStats>();
    for (let i = 0; i < months; i++) {
      const monthStart = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + i, 1));
      byMonth.set(monthKey(monthStart), { month: monthKey(monthStart), trades: 0, netPnl: 0, cashFlow: 0, returnPct: null });
    }
    for (const t of periodTrades) {
      const bucket = byMonth.get(monthKey(t.time));
      if (bucket) { bucket.trades += 1; bucket.netPnl += t.amount; }
    }
    for (const op of periodOps) {
      const bucket = byMonth.get(monthKey(op.time));
      if (bucket) bucket.cashFlow += op.amount;
    }
    for (const bucket of byMonth.values()) {
      const monthStart = startOfUtcMonth(new Date(`${bucket.month}-01T00:00:00Z`));
      const effectiveStart = monthStart > periodStart ? monthStart : periodStart;
      bucket.returnPct = returnPct(bucket.netPnl, balanceBefore(effectiveStart), bucket.cashFlow);
      monthly.push(bucket);
    }
  }

  const curve: CurvePoint[] = [];
  if (periodStart) {
    const firstDay = startOfUtcDay(periodStart);
    const lastDay = startOfUtcDay(periodEnd);
    for (let d = firstDay.getTime(); d <= lastDay.getTime(); d += DAY_MS) {
      const endOfDay = new Date(d + DAY_MS - 1);
      curve.push({ date: dayKey(new Date(d)), balance: balanceAt(endOfDay) });
    }
  }

  const operations: BalanceOperationSummary[] = [...periodOps]
    .reverse()
    .map(op => ({ time: op.time.toISOString(), amount: op.amount, comment: op.comment ?? '' }));

  return {
    broker,
    currency: latest?.currency ?? '',
    period: { from: periodStart?.toISOString() ?? null, to: to?.toISOString() ?? null, months },
    trades: periodTrades.length,
    wins: periodTrades.filter(t => t.amount > 0).length,
    losses: periodTrades.filter(t => t.amount < 0).length,
    netPnl,
    cashFlow,
    tradesPerMonth: months > 0 ? periodTrades.length / months : 0,
    startBalance: latest ? startBalance : null,
    returnPct: latest ? returnPct(netPnl, startBalance, cashFlow) : null,
    monthly,
    curve,
    operations,
  };
}
