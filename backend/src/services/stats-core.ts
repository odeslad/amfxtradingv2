export interface MonthlyStats {
  month: string;
  trades: number;
  wins: number;
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

export interface Movement {
  amount: number;
  time: Date;
  comment?: string;
}

export interface LatestBalance {
  balance: number;
  currency: string;
  timestamp: Date;
}

export interface StatsInput {
  broker: string;
  latest: LatestBalance | null;
  // Both lists sorted ascending by time; already filtered to `>= from` when `from` is given.
  trades: Movement[];
  operations: Movement[];
  from?: Date;
  to?: Date;
  now?: Date;
  // 'asset': the trades of one symbol only (spec 029). Balance operations belong to no
  // asset: cash flow is 0 and the curve is the cumulative P&L. The return is the asset's
  // contribution to the account return, measured against the account's own movements.
  mode?: 'account' | 'asset';
  accountTrades?: Movement[];
  accountOperations?: Movement[];
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

// Pure: every number the Stats page shows, derived from the latest balance snapshot
// (the anchor) and the movements loaded by the caller.
export function computeStats({ broker, latest, trades: allTrades, operations: rawOperations, from, to, now = new Date(), mode = 'account', accountTrades, accountOperations }: StatsInput): BrokerStats {
  const asset = mode === 'asset';
  const allOperations = asset ? [] : rawOperations;
  // The balance always comes from the whole account; in asset mode without it there is no return.
  const hasAccount = !asset || (accountTrades !== undefined && accountOperations !== undefined);
  const accTrades = asset ? accountTrades ?? [] : allTrades;
  const accOps = asset ? accountOperations ?? [] : allOperations;
  const periodEnd = to ?? now;
  const periodTrades = to ? allTrades.filter(t => t.time <= periodEnd) : allTrades;
  const periodStart = from ?? periodTrades[0]?.time ?? null;
  const periodOps = periodStart ? inWindow(allOperations, periodStart, periodEnd) : [];

  const tradesAfter = afterSum(accTrades, suffixSums(accTrades));
  const opsAfter = afterSum(accOps, suffixSums(accOps));
  const accountPeriodOps = periodStart ? inWindow(accOps, periodStart, periodEnd) : [];
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
      byMonth.set(monthKey(monthStart), { month: monthKey(monthStart), trades: 0, wins: 0, netPnl: 0, cashFlow: 0, returnPct: null });
    }
    for (const t of periodTrades) {
      const bucket = byMonth.get(monthKey(t.time));
      if (bucket) {
        bucket.trades += 1;
        bucket.netPnl += t.amount;
        if (t.amount > 0) bucket.wins += 1;
      }
    }
    for (const op of periodOps) {
      const bucket = byMonth.get(monthKey(op.time));
      if (bucket) bucket.cashFlow += op.amount;
    }
    const accountCashByMonth = new Map<string, number>();
    for (const op of accountPeriodOps) accountCashByMonth.set(monthKey(op.time), (accountCashByMonth.get(monthKey(op.time)) ?? 0) + op.amount);
    for (const bucket of byMonth.values()) {
      const monthStart = startOfUtcMonth(new Date(`${bucket.month}-01T00:00:00Z`));
      const effectiveStart = monthStart > periodStart ? monthStart : periodStart;
      bucket.returnPct = hasAccount ? returnPct(bucket.netPnl, balanceBefore(effectiveStart), accountCashByMonth.get(bucket.month) ?? 0) : null;
      monthly.push(bucket);
    }
  }

  const curve: CurvePoint[] = [];
  if (periodStart) {
    const firstDay = startOfUtcDay(periodStart);
    const lastDay = startOfUtcDay(periodEnd);
    let cumulative = 0;
    let next = 0;
    for (let d = firstDay.getTime(); d <= lastDay.getTime(); d += DAY_MS) {
      const endOfDay = new Date(d + DAY_MS - 1);
      if (asset) {
        while (next < periodTrades.length && periodTrades[next].time <= endOfDay) cumulative += periodTrades[next++].amount;
        curve.push({ date: dayKey(new Date(d)), balance: cumulative });
      } else {
        curve.push({ date: dayKey(new Date(d)), balance: balanceAt(endOfDay) });
      }
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
    startBalance: latest && hasAccount ? startBalance : null,
    returnPct: latest && hasAccount ? returnPct(netPnl, startBalance, sum(accountPeriodOps)) : null,
    monthly,
    curve,
    operations,
  };
}
