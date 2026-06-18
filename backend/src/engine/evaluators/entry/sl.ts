export interface SLConfig {
  type: 'fixed' | 'evl';
  pips: number;
  minPips: number | null;
  maxPips: number | null;
  evlOffset: number;
}

export function calculateSl(
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
