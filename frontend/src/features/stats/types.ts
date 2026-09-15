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
