import type { Candle } from '../indicators/ema';
import type { PivotPoint } from './ema-cross';
import { calculateSl, type SLConfig } from './entry/sl';
import { calculateTp, type ExitConfig } from './entry/exit';
import { scanResult } from './entry/scan';
import { findActivation, resolveScanParams } from './entry/activation';
import type { TrailConfig } from './entry/trail';

export type { SLConfig } from './entry/sl';
export type { ExitConfig } from './entry/exit';
export type { TrailConfig } from './entry/trail';
export type { SizingConfig } from './entry/sizing';

export interface EntryConfig {
  type: 'ECC' | 'EMA' | 'EVL' | 'MHL';
  enabled: boolean;
  invert: boolean;
  offset: number;
  windowStart: number;
  windowEnd: number;
  sl: SLConfig;
  exit: ExitConfig;
  trail?: TrailConfig;
}

export interface TradeResult {
  entryType: string;
  direction: 'buy' | 'sell';
  entryPrice: number;
  entryTime: Date | null;
  sl: number;
  tp: number | null;
  exitTime: Date | null;
  exitPrice: number | null;
  resultPips: number | null;
  status: 'open' | 'closed' | 'missed';
  reason: 'SL' | 'TP' | 'window elapsed' | 'setup finished' | null;
}

type Levels = { ECC: number; EMA: number; EVL: number | null; MHL: number | null };

const DEFAULT_TRAIL: TrailConfig = {
  type: 'none',
  level: 'extreme',
  offset: 0,
  distance: 0,
  updateEvery: 1,
  toRR: null,
  activateCandles: null,
  activateMode: 'or',
};

interface Setup {
  candles: Candle[];
  setupDirection: 'buy' | 'sell';
  activationIndex: number;
  closeIndex: number | null;
  levels: Levels;
  pipSize: number;
  tfMs: number;
  weakCandles: Date[];
  strongCandles: Date[];
  pivots: PivotPoint[];
}

export function evaluateEntries(
  candles: Candle[],
  setupDirection: 'buy' | 'sell',
  activationIndex: number,
  closeIndex: number | null,
  levels: Levels,
  entries: EntryConfig[],
  pipSize: number,
  tfMs: number,
  setupWeakCandles: Date[] = [],
  setupStrongCandles: Date[] = [],
  setupPivots: PivotPoint[] = [],
): TradeResult[] {
  const ctx: Setup = { candles, setupDirection, activationIndex, closeIndex, levels, pipSize, tfMs, weakCandles: setupWeakCandles, strongCandles: setupStrongCandles, pivots: setupPivots };
  return entries.filter(ec => ec.enabled).map(entryConfig => evaluateSingleEntry(ctx, entryConfig));
}

function evaluateSingleEntry(ctx: Setup, entryConfig: EntryConfig): TradeResult {
  const { candles, setupDirection, activationIndex, closeIndex, levels, pipSize, tfMs, weakCandles, strongCandles, pivots } = ctx;

  const levelPrice = levels[entryConfig.type];
  if (levelPrice === null || levelPrice === undefined) {
    return missedTrade(entryConfig, setupDirection, 0, calculateSl(entryConfig.sl, setupDirection, 0, { evl: levels.EVL, mhl: levels.MHL }, pipSize), 'window elapsed');
  }

  const direction = entryConfig.invert
    ? (setupDirection === 'buy' ? 'sell' : 'buy')
    : setupDirection;

  const entryPrice = direction === 'buy'
    ? levelPrice + entryConfig.offset * pipSize
    : levelPrice - entryConfig.offset * pipSize;

  // The setup is confirmed at the CLOSE of its activation candle, so an entry
  // can only trigger on the following candle onward — never on the setup candle
  // itself. windowStart/windowEnd are offsets counted from that next candle.
  const windowStartIndex = activationIndex + 1 + entryConfig.windowStart;
  const windowEnd = Math.min(
    activationIndex + 1 + entryConfig.windowEnd,
    closeIndex ?? candles.length - 1,
    candles.length - 1,
  );

  const activationCandleIndex = findActivation(candles, entryConfig, direction, windowStartIndex, windowEnd, entryPrice);

  if (activationCandleIndex === null) {
    const reason = (closeIndex !== null && closeIndex <= activationIndex + 1 + entryConfig.windowEnd) ? 'setup finished' : 'window elapsed';
    return missedTrade(entryConfig, direction, entryPrice, calculateSl(entryConfig.sl, direction, entryPrice, { evl: levels.EVL, mhl: levels.MHL }, pipSize), reason);
  }

  const slPrice = calculateSl(entryConfig.sl, direction, entryPrice, { evl: levels.EVL, mhl: levels.MHL }, pipSize);
  const slDistancePips = Math.abs(entryPrice - slPrice) / pipSize;
  const tpPrice = calculateTp(entryConfig.exit, direction, entryPrice, slDistancePips, pipSize);
  const { scanFrom, entryTime } = resolveScanParams(candles, entryConfig, activationCandleIndex, tfMs);
  const trail = entryConfig.trail ?? DEFAULT_TRAIL;
  const result = scanResult(candles, scanFrom, candles.length - 1, direction, entryPrice, slPrice, tpPrice, pipSize, tfMs, trail, weakCandles, strongCandles, pivots);

  return { entryType: entryConfig.type, direction, entryPrice, entryTime, sl: slPrice, tp: tpPrice, ...result };
}

function missedTrade(
  entryConfig: EntryConfig,
  direction: 'buy' | 'sell',
  entryPrice: number,
  sl: number,
  reason: 'window elapsed' | 'setup finished',
): TradeResult {
  return { entryType: entryConfig.type, direction, entryPrice, entryTime: null, sl, tp: null, exitTime: null, exitPrice: null, resultPips: null, status: 'missed', reason };
}
