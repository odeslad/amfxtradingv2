import { calculateEma, type Candle } from '../indicators/ema';

export interface EmaCrossContext {
  emaFast: number;
  emaSlow: number;
  direction: 'buy' | 'sell';
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

export function detectEmaCrossSetups(candles: Candle[], context: EmaCrossContext): EmaCrossSetup[] {
  const { emaFast: fastPeriod, emaSlow: slowPeriod, direction } = context;

  const fastEma = calculateEma(candles, fastPeriod);
  const slowEma = calculateEma(candles, slowPeriod);

  const setups: EmaCrossSetup[] = [];
  let prevSetupCloseIndex: number | null = null;

  for (let i = 1; i < candles.length; i++) {
    const prevFast = fastEma[i - 1];
    const prevSlow = slowEma[i - 1];
    const currFast = fastEma[i];
    const currSlow = slowEma[i];

    if (prevFast === null || prevSlow === null || currFast === null || currSlow === null) continue;

    const isBullishCross = prevFast <= prevSlow && currFast > currSlow;
    const isBearishCross = prevFast >= prevSlow && currFast < currSlow;
    const isCross = direction === 'buy' ? isBullishCross : isBearishCross;

    if (!isCross) continue;

    const emaLevel = interpolateCross(
      candles[i - 1].close, prevFast, prevSlow,
      candles[i].close, currFast, currSlow,
    );

    const evl = findEvl(candles, fastEma, i, prevSetupCloseIndex ?? 0, direction);
    const mhl = prevSetupCloseIndex !== null ? findMhl(candles, prevSetupCloseIndex, i, direction) : null;

    const closeResult = findSetupClose(candles, fastEma, slowEma, i, direction);

    const setup: EmaCrossSetup = {
      direction,
      activationIndex: i,
      activationTime: candles[i].time,
      activationPrice: candles[i].close,
      closeIndex: closeResult?.index ?? null,
      closeTime: closeResult ? candles[closeResult.index].time : null,
      closePrice: closeResult ? candles[closeResult.index].close : null,
      candleCount: closeResult ? closeResult.index - i : candles.length - 1 - i,
      levels: { ECC: candles[i].close, EMA: emaLevel, EVL: evl, MHL: mhl },
    };

    setups.push(setup);
    prevSetupCloseIndex = i;
  }

  return setups;
}

function interpolateCross(
  prevClose: number, prevFast: number, prevSlow: number,
  currClose: number, currFast: number, currSlow: number,
): number {
  const prevDiff = prevFast - prevSlow;
  const currDiff = currFast - currSlow;
  const t = Math.abs(prevDiff) / (Math.abs(prevDiff) + Math.abs(currDiff));
  return prevClose + t * (currClose - prevClose);
}

function findEvl(
  candles: Candle[],
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
