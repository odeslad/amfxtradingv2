import { calculateEma, type Candle } from '../indicators/ema';

export interface EmaCrossContext {
  emaFast: number;
  emaSlow: number;
  direction: 'buy' | 'sell' | 'both';
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
}

interface CrossEvent {
  index: number;
  direction: 'buy' | 'sell';
}

export function detectEmaCrossSetups(candles: Candle[], context: EmaCrossContext): EmaCrossSetup[] {
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
