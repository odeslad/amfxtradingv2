import type { Candle } from '../indicators/ema';

export interface SLConfig {
  type: 'fixed' | 'evl';
  pips: number;
  minPips: number | null;
  maxPips: number | null;
  evlOffset: number;
}

export interface ExitConfig {
  type: 'none' | 'fixed' | 'rr';
  pips: number | null;
  rr: number | null;
}

export interface EntryConfig {
  type: 'ECC' | 'EMA' | 'EVL' | 'MHL';
  enabled: boolean;
  invert: boolean;
  offset: number;
  window: number;
  sl: SLConfig;
  exit: ExitConfig;
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

export function evaluateEntries(
  candles: Candle[],
  setupDirection: 'buy' | 'sell',
  activationIndex: number,
  closeIndex: number | null,
  levels: Levels,
  entries: EntryConfig[],
  pipSize: number,
): TradeResult[] {
  const results: TradeResult[] = [];

  for (const entry of entries) {
    if (!entry.enabled) continue;

    const levelPrice = levels[entry.type];
    if (levelPrice === null || levelPrice === undefined) continue;

    const direction = entry.invert
      ? (setupDirection === 'buy' ? 'sell' : 'buy')
      : setupDirection;

    const entryPrice = direction === 'buy'
      ? levelPrice + entry.offset * pipSize
      : levelPrice - entry.offset * pipSize;

    const windowEnd = Math.min(
      activationIndex + entry.window,
      closeIndex ?? candles.length - 1,
      candles.length - 1,
    );

    const activationCandleIndex = findActivation(
      candles, entry, direction, activationIndex, windowEnd, entryPrice,
    );

    if (activationCandleIndex === null) {
      const missedReason = (closeIndex !== null && closeIndex <= activationIndex + entry.window)
        ? 'setup finished'
        : 'window elapsed';
      results.push({
        entryType: entry.type,
        direction,
        entryPrice,
        entryTime: null,
        sl: calculateSl(entry.sl, direction, entryPrice, levels.EVL, pipSize),
        tp: null,
        exitTime: null,
        exitPrice: null,
        resultPips: null,
        status: 'missed',
        reason: missedReason,
      });
      continue;
    }

    const slPrice = calculateSl(entry.sl, direction, entryPrice, levels.EVL, pipSize);
    const slDistancePips = Math.abs(entryPrice - slPrice) / pipSize;
    const tpPrice = calculateTp(entry.exit, direction, entryPrice, slDistancePips, pipSize);
    const result = scanResult(candles, activationCandleIndex, candles.length - 1, direction, entryPrice, slPrice, tpPrice, pipSize);

    results.push({
      entryType: entry.type,
      direction,
      entryPrice,
      entryTime: candles[activationCandleIndex].time,
      sl: slPrice,
      tp: tpPrice,
      ...result,
    });
  }

  return results;
}

function findActivation(
  candles: Candle[],
  entry: EntryConfig,
  direction: 'buy' | 'sell',
  activationIndex: number,
  windowEnd: number,
  entryPrice: number,
): number | null {
  if (entry.type === 'ECC' && entry.offset === 0 && entry.window === 0) {
    return activationIndex;
  }

  for (let i = activationIndex; i <= windowEnd; i++) {
    const touched = direction === 'buy'
      ? candles[i].low <= entryPrice
      : candles[i].high >= entryPrice;
    if (touched) return i;
  }

  return null;
}

function calculateSl(
  sl: SLConfig,
  direction: 'buy' | 'sell',
  entryPrice: number,
  evl: number | null,
  pipSize: number,
): number {
  let slPrice: number;

  if (sl.type === 'evl' && evl !== null) {
    slPrice = direction === 'buy'
      ? evl - sl.evlOffset * pipSize
      : evl + sl.evlOffset * pipSize;
  } else {
    slPrice = direction === 'buy'
      ? entryPrice - sl.pips * pipSize
      : entryPrice + sl.pips * pipSize;
  }

  const distPips = Math.abs(entryPrice - slPrice) / pipSize;

  if (sl.minPips !== null && distPips < sl.minPips) {
    slPrice = direction === 'buy'
      ? entryPrice - sl.minPips * pipSize
      : entryPrice + sl.minPips * pipSize;
  }
  if (sl.maxPips !== null && distPips > sl.maxPips) {
    slPrice = direction === 'buy'
      ? entryPrice - sl.maxPips * pipSize
      : entryPrice + sl.maxPips * pipSize;
  }

  return slPrice;
}

function calculateTp(
  exit: ExitConfig,
  direction: 'buy' | 'sell',
  entryPrice: number,
  slDistancePips: number,
  pipSize: number,
): number | null {
  if (exit.type === 'fixed' && exit.pips !== null) {
    return direction === 'buy'
      ? entryPrice + exit.pips * pipSize
      : entryPrice - exit.pips * pipSize;
  }
  if (exit.type === 'rr' && exit.rr !== null) {
    return direction === 'buy'
      ? entryPrice + slDistancePips * exit.rr * pipSize
      : entryPrice - slDistancePips * exit.rr * pipSize;
  }
  return null;
}

function scanResult(
  candles: Candle[],
  fromIndex: number,
  toIndex: number,
  direction: 'buy' | 'sell',
  entryPrice: number,
  slPrice: number,
  tpPrice: number | null,
  pipSize: number,
): Pick<TradeResult, 'exitTime' | 'exitPrice' | 'resultPips' | 'status' | 'reason'> {
  for (let i = fromIndex + 1; i <= toIndex; i++) {
    const candle = candles[i];

    if (direction === 'buy') {
      if (candle.low <= slPrice) {
        return { status: 'closed', reason: 'SL', exitTime: candle.time, exitPrice: slPrice, resultPips: (slPrice - entryPrice) / pipSize };
      }
      if (tpPrice !== null && candle.high >= tpPrice) {
        return { status: 'closed', reason: 'TP', exitTime: candle.time, exitPrice: tpPrice, resultPips: (tpPrice - entryPrice) / pipSize };
      }
    } else {
      if (candle.high >= slPrice) {
        return { status: 'closed', reason: 'SL', exitTime: candle.time, exitPrice: slPrice, resultPips: (entryPrice - slPrice) / pipSize };
      }
      if (tpPrice !== null && candle.low <= tpPrice) {
        return { status: 'closed', reason: 'TP', exitTime: candle.time, exitPrice: tpPrice, resultPips: (entryPrice - tpPrice) / pipSize };
      }
    }
  }

  return { status: 'open', reason: null, exitTime: null, exitPrice: null, resultPips: null };
}
