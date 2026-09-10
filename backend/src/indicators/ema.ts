export interface Candle {
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function calculateEma(candles: Candle[], period: number): (number | null)[] {
  if (candles.length === 0) return [];

  const k = 2 / (period + 1);
  const result: (number | null)[] = new Array(candles.length).fill(null);

  let seedIndex = period - 1;
  if (seedIndex >= candles.length) return result;

  const seed = candles.slice(0, period).reduce((sum, c) => sum + c.close, 0) / period;
  result[seedIndex] = seed;

  for (let i = seedIndex + 1; i < candles.length; i++) {
    result[i] = candles[i].close * k + result[i - 1]! * (1 - k);
  }

  return result;
}
