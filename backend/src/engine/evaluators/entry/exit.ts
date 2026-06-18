export interface ExitConfig {
  type: 'none' | 'fixed' | 'rr';
  pips: number | null;
  rr: number | null;
}

export function calculateTp(
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
