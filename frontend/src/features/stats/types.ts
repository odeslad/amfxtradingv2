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

export interface BalanceOperation {
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
  operations: BalanceOperation[];
  // spec 029: the asset filtered on (null = all) and the symbols traded on the broker
  symbol: string | null;
  symbols: string[];
}
