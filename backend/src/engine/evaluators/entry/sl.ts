export interface SLConfig {
  type: 'fixed' | 'evl' | 'mhl';
  pips: number;
  minPips: number | null;
  maxPips: number | null;
  evlOffset: number;
  mhlOffset: number;
}

export function calculateSl(
  sl: SLConfig,
  direction: 'buy' | 'sell',
  entryPrice: number,
  levels: { evl: number | null; mhl: number | null },
  pipSize: number,
): number {
  let slPrice: number;

  if (sl.type === 'evl' && levels.evl !== null) {
    slPrice = direction === 'buy'
      ? levels.evl - sl.evlOffset * pipSize
      : levels.evl + sl.evlOffset * pipSize;
  } else if (sl.type === 'mhl' && levels.mhl !== null) {
    slPrice = direction === 'buy'
      ? levels.mhl - sl.mhlOffset * pipSize
      : levels.mhl + sl.mhlOffset * pipSize;
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
