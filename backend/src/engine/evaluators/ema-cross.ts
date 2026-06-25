import { calculateEma, type Candle } from '../indicators/ema';

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

export interface EmaCrossContext {
  emaFast: number;
  emaSlow: number;
  direction: 'buy' | 'sell' | 'both';
  pivotLen?: number;
  weakConfig?: WeakConfig;
  strongConfig?: StrongConfig;
}

export interface PivotPoint {
  type: 'high' | 'low';
  price: number;
  time: Date;
}

export interface EmaCrossSetup {
  direction: 'buy' | 'sell';
  activationIndex: number;
  activationTime: Date;
  activationPrice: number;
  closeIndex: number | null;
  closeTime: Date | null;
  closePrice: number | null;
  candleCount: number;
  levels: {
    ECC: number;
    EMA: number;
    EVL: number | null;
    MHL: number | null;
  };
  weakCandles: Date[];
  strongCandles: Date[];
  pivots: PivotPoint[];
  mfePrice: number | null;
  mfeTime: Date | null;
  maePrice: number | null;
  maeTime: Date | null;
}

interface CrossEvent {
  index: number;
  direction: 'buy' | 'sell';
}

export function detectEmaCrossSetups(candles: Candle[], context: EmaCrossContext, pipSize = 0.0001): EmaCrossSetup[] {
  const { emaFast: fastPeriod, emaSlow: slowPeriod, direction } = context;

  const fastEma = calculateEma(candles, fastPeriod);
  const slowEma = calculateEma(candles, slowPeriod);

  // First pass: detect all crosses in both directions
  const allCrosses: CrossEvent[] = [];
  for (let i = 1; i < candles.length; i++) {
    const prevFast = fastEma[i - 1];
    const prevSlow = slowEma[i - 1];
    const currFast = fastEma[i];
    const currSlow = slowEma[i];
    if (prevFast === null || prevSlow === null || currFast === null || currSlow === null) continue;

    if (prevFast <= prevSlow && currFast > currSlow) allCrosses.push({ index: i, direction: 'buy' });
    else if (prevFast >= prevSlow && currFast < currSlow) allCrosses.push({ index: i, direction: 'sell' });
  }

  // Second pass: build setups for the requested direction(s)
  const targetDirections: ('buy' | 'sell')[] = direction === 'both' ? ['buy', 'sell'] : [direction];
  const setups: EmaCrossSetup[] = [];

  for (const cross of allCrosses) {
    if (!targetDirections.includes(cross.direction)) continue;

    const i = cross.index;
    const prevFast = fastEma[i - 1]!;
    const prevSlow = slowEma[i - 1]!;
    const currFast = fastEma[i]!;
    const currSlow = slowEma[i]!;

    const emaLevel = interpolateCross(prevFast, prevSlow, currFast, currSlow);
    const closeResult = findSetupClose(candles, fastEma, slowEma, i, cross.direction);
    const closeIndex = closeResult?.index ?? null;

    // Previous context starts at the last opposite cross before this one
    const prevOppositeCross = findPreviousOppositeCross(allCrosses, i, cross.direction);
    const contextStart = prevOppositeCross ?? 0;

    const evl = findEvl(fastEma, i, contextStart, cross.direction);
    const mhl = prevOppositeCross !== null ? findMhl(candles, contextStart, i, cross.direction) : null;

    const windowEnd = closeIndex ?? candles.length - 1;
    const { weakCandles, strongCandles } = classifyCandles(
      candles, fastEma, slowEma, i, windowEnd, cross.direction, context, pipSize,
    );

    setups.push({
      direction: cross.direction,
      activationIndex: i,
      activationTime: candles[i].time,
      activationPrice: candles[i].close,
      closeIndex,
      closeTime: closeIndex !== null ? candles[closeIndex].time : null,
      closePrice: closeIndex !== null ? candles[closeIndex].close : null,
      candleCount: closeIndex !== null ? closeIndex - i : candles.length - 1 - i,
      levels: { ECC: candles[i].close, EMA: emaLevel, EVL: evl, MHL: mhl },
      weakCandles,
      strongCandles,
      pivots: detectPivots(candles, i, windowEnd, context.pivotLen ?? 5),
      ...calculateMaeMfe(candles, i, windowEnd, cross.direction),
    });
  }

  return setups;
}

function findPreviousOppositeCross(
  allCrosses: CrossEvent[],
  currentIndex: number,
  direction: 'buy' | 'sell',
): number | null {
  const opposite = direction === 'buy' ? 'sell' : 'buy';
  for (let i = allCrosses.length - 1; i >= 0; i--) {
    if (allCrosses[i].direction === opposite && allCrosses[i].index < currentIndex) {
      return allCrosses[i].index;
    }
  }
  return null;
}

function interpolateCross(
  prevFast: number, prevSlow: number,
  currFast: number, currSlow: number,
): number {
  const prevDiff = prevFast - prevSlow;
  const currDiff = currFast - currSlow;
  const t = Math.abs(prevDiff) / (Math.abs(prevDiff) + Math.abs(currDiff));
  return prevFast + t * (currFast - prevFast);
}

function findEvl(
  fastEma: (number | null)[],
  crossIndex: number,
  searchFrom: number,
  direction: 'buy' | 'sell',
): number | null {
  let extreme: number | null = null;

  for (let i = searchFrom; i < crossIndex; i++) {
    const val = fastEma[i];
    if (val === null) continue;
    if (direction === 'buy') {
      if (extreme === null || val < extreme) extreme = val;
    } else {
      if (extreme === null || val > extreme) extreme = val;
    }
  }

  return extreme;
}

function findMhl(
  candles: Candle[],
  fromIndex: number,
  toIndex: number,
  direction: 'buy' | 'sell',
): number | null {
  let extreme: number | null = null;

  for (let i = fromIndex; i < toIndex; i++) {
    const val = direction === 'buy' ? candles[i].low : candles[i].high;
    if (extreme === null || (direction === 'buy' ? val < extreme : val > extreme)) {
      extreme = val;
    }
  }

  return extreme;
}

function detectPivots(
  candles: Candle[],
  fromIndex: number,
  toIndex: number,
  pivotLen: number,
): PivotPoint[] {
  const pivots: PivotPoint[] = [];
  let lastType: 'high' | 'low' | null = null;

  for (let i = fromIndex; i <= toIndex; i++) {
    if (i - pivotLen < 0 || i + pivotLen >= candles.length) continue;

    const isHigh = isSwingHigh(candles, i, pivotLen);
    const isLow = isSwingLow(candles, i, pivotLen);

    if (isHigh && (lastType === null || lastType === 'low')) {
      pivots.push({ type: 'high', price: candles[i].high, time: candles[i].time });
      lastType = 'high';
    } else if (isLow && (lastType === null || lastType === 'high')) {
      pivots.push({ type: 'low', price: candles[i].low, time: candles[i].time });
      lastType = 'low';
    }
  }

  return pivots;
}

function isSwingHigh(candles: Candle[], index: number, len: number): boolean {
  const val = candles[index].high;
  for (let i = index - len; i <= index + len; i++) {
    if (i === index) continue;
    if (candles[i].high >= val) return false;
  }
  return true;
}

function isSwingLow(candles: Candle[], index: number, len: number): boolean {
  const val = candles[index].low;
  for (let i = index - len; i <= index + len; i++) {
    if (i === index) continue;
    if (candles[i].low <= val) return false;
  }
  return true;
}

function calculateMaeMfe(
  candles: Candle[],
  fromIndex: number,
  toIndex: number,
  direction: 'buy' | 'sell',
): { mfePrice: number | null; mfeTime: Date | null; maePrice: number | null; maeTime: Date | null } {
  let mfePrice: number | null = null;
  let mfeIndex: number | null = null;

  for (let i = fromIndex + 1; i <= toIndex; i++) {
    const val = direction === 'buy' ? candles[i].high : candles[i].low;
    if (mfePrice === null || (direction === 'buy' ? val > mfePrice : val < mfePrice)) {
      mfePrice = val;
      mfeIndex = i;
    }
  }

  let maePrice: number | null = null;
  let maeTime: Date | null = null;

  if (mfeIndex !== null) {
    for (let i = fromIndex + 1; i <= mfeIndex; i++) {
      const val = direction === 'buy' ? candles[i].low : candles[i].high;
      if (maePrice === null || (direction === 'buy' ? val < maePrice : val > maePrice)) {
        maePrice = val;
        maeTime = candles[i].time;
      }
    }
  }

  return {
    mfePrice,
    mfeTime: mfeIndex !== null ? candles[mfeIndex].time : null,
    maePrice,
    maeTime,
  };
}

function classifyCandles(
  candles: Candle[],
  fastEma: (number | null)[],
  slowEma: (number | null)[],
  fromIndex: number,
  toIndex: number,
  direction: 'buy' | 'sell',
  context: EmaCrossContext,
  pipSize: number,
): { weakCandles: Date[]; strongCandles: Date[] } {
  const weak: Date[] = [];
  const strong: Date[] = [];
  const { weakConfig, strongConfig } = context;

  for (let i = fromIndex + 1; i <= toIndex; i++) {
    const fast = fastEma[i];
    const slow = slowEma[i];
    if (fast === null || slow === null) continue;

    const candle = candles[i];
    const spread = Math.abs(fast - slow) / pipSize;

    if (weakConfig?.enabled) {
      const belowBoth = direction === 'buy'
        ? candle.close < fast && candle.close < slow
        : candle.close > fast && candle.close > slow;

      const spreadOk = !weakConfig.useMaxSpread || spread <= weakConfig.maxSpreadPips;

      if (belowBoth && spreadOk) weak.push(candle.time);
    }

    if (strongConfig?.enabled) {
      const aboveBoth = direction === 'buy'
        ? candle.close > fast && candle.close > slow
        : candle.close < fast && candle.close < slow;

      const spreadOk = !strongConfig.useMinSpread || spread >= strongConfig.minSpreadPips;

      if (aboveBoth && spreadOk) strong.push(candle.time);
    }
  }

  return { weakCandles: weak, strongCandles: strong };
}

function findSetupClose(
  candles: Candle[],
  fastEma: (number | null)[],
  slowEma: (number | null)[],
  fromIndex: number,
  direction: 'buy' | 'sell',
): { index: number } | null {
  for (let i = fromIndex + 1; i < candles.length; i++) {
    const prevFast = fastEma[i - 1];
    const prevSlow = slowEma[i - 1];
    const currFast = fastEma[i];
    const currSlow = slowEma[i];

    if (prevFast === null || prevSlow === null || currFast === null || currSlow === null) continue;

    const isOppositeClose = direction === 'buy'
      ? prevFast >= prevSlow && currFast < currSlow
      : prevFast <= prevSlow && currFast > currSlow;

    if (isOppositeClose) return { index: i };
  }

  return null;
}
