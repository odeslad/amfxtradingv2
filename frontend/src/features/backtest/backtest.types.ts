export type Direction = 'buy' | 'sell' | 'both';
export type EntryType = 'ECC' | 'EMA' | 'EVL' | 'MHL';
export type Timeframe = 'M5' | 'M15' | 'H1' | 'H4' | 'D1';

export interface WeakConfig {
  enabled: boolean;
  maxSpreadPips: number;
  useMaxSpread: boolean;
}

export interface StrongConfig {
  enabled: boolean;
  minSpreadPips: number;
  useMinSpread: boolean;
}

export interface EmaCrossSetup {
  type: 'ema_cross';
  emaFast: number;
  emaSlow: number;
  direction: Direction;
  pivotLen: number;
  weakConfig: WeakConfig;
  strongConfig: StrongConfig;
}

export interface SLConfig {
  type: 'fixed' | 'evl' | 'mhl';
  pips: number;
  minPips: number | null;
  maxPips: number | null;
  evlOffset: number;
  mhlOffset: number;
}

export interface ExitConfig {
  type: 'none' | 'fixed' | 'rr';
  pips: number | null;
  rr: number | null;
}

export interface TrailConfig {
  type: 'none' | 'weak' | 'pivot' | 'fixed';
  level: 'extreme' | 'close';
  offset: number;
  distance: number;
  updateEvery: number;
  toRR: number | null;
  activateCandles: number | null;
  activateMode: 'and' | 'or';
}

export interface EntryConfig {
  type: EntryType;
  enabled: boolean;
  invert: boolean;
  offset: number;
  windowStart: number;
  windowEnd: number;
  sl: SLConfig;
  exit: ExitConfig;
  trail: TrailConfig;
}

export interface StrategyForm {
  id: string;
  name: string;
  instrument: string;
  timeframe: Timeframe;
  setup: EmaCrossSetup;
  entries: EntryConfig[];
}

export interface StrategyConfig {
  forms: StrategyForm[];
}

export interface Strategy {
  id: number;
  broker: string;
  symbol: string;
  timeframe: string;
  config: StrategyConfig;
  active: boolean;
}

export interface BacktestTrade {
  id: number;
  entryType: EntryType;
  entryPrice: number;
  sl: number;
  tp: number;
  entryTime: string | null;
  exitTime: string | null;
  exitPrice: number | null;
  resultPips: number | null;
  status: 'open' | 'closed' | 'missed';
  reason: string | null;
}

export interface BacktestSetup {
  id: number;
  direction: 'buy' | 'sell';
  activationTime: string;
  activationPrice: number;
  closeTime: string | null;
  closePrice: number | null;
  levels: { ECC: number; EMA: number; EVL: number | null; MHL: number | null };
  candleCount: number;
  trades: BacktestTrade[];
}

export interface BacktestRun {
  // id / strategyId / createdAt are absent on ephemeral preview runs.
  id?: number;
  strategyId?: number;
  broker: string;
  symbol: string;
  timeframe: string;
  dateFrom: string;
  dateTo: string;
  createdAt?: string;
  setups: BacktestSetup[];
}
