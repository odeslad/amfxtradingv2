import { db } from '../db/client';
import { calculateEma, type Candle } from '../engine/indicators/ema';
import { detectEmaCrossSetups } from '../engine/evaluators/ema-cross';
import { getPipSize } from '../engine/pip-size';
import { getTimeframeMs } from '../engine/timeframe';

export interface ScannerCross {
  direction: 'buy' | 'sell';
  time: string;         // activation (cross) time
  mfePips: number | null;
  maePips: number | null;
}

export interface ScannerRow {
  symbol: string;
  // Signed gap between fast and slow EMA in pips (>0 fast above slow).
  gapPips: number;
  // How fast the |gap| is shrinking per candle, in pips (>0 = converging).
  convergencePips: number;
  // Estimated candles until the cross, null if not converging.
  etaCandles: number | null;
  etaMs: number | null;
  // Which cross is approaching given the current side + convergence.
  approaching: 'buy' | 'sell' | null;
  lastCrosses: ScannerCross[];
}

export interface ScannerResult {
  buys: ScannerRow[];
  sells: ScannerRow[];
}

const MAX_CANDLES = 2000;
const LAST_CROSSES = 5;

async function evaluateSymbol(
  broker: string, symbol: string, timeframe: string,
  emaFast: number, emaSlow: number,
): Promise<ScannerRow | null> {
  const need = Math.max(emaFast, emaSlow) + 5;
  const rows = await db.candle.findMany({
    where: { broker, symbol, timeframe },
    orderBy: { time: 'desc' },
    take: MAX_CANDLES,
    select: { time: true, open: true, high: true, low: true, close: true },
  });
  if (rows.length < need) return null;
  const candles = rows.reverse() as Candle[];

  const pip = getPipSize(symbol);
  const fast = calculateEma(candles, emaFast);
  const slow = calculateEma(candles, emaSlow);
  const n = candles.length;
  const fNow = fast[n - 1], sNow = slow[n - 1];
  const fPrev = fast[n - 2], sPrev = slow[n - 2];
  if (fNow === null || sNow === null || fPrev === null || sPrev === null) return null;

  const gapPips = (fNow - sNow) / pip;
  const gapPrev = (fPrev - sPrev) / pip;
  // Positive convergence = the absolute gap is shrinking toward a cross.
  const convergencePips = Math.abs(gapPrev) - Math.abs(gapPips);
  const etaCandles = convergencePips > 0 ? Math.abs(gapPips) / convergencePips : null;
  const tfMs = getTimeframeMs(timeframe);
  const etaMs = etaCandles !== null ? Math.round(etaCandles * tfMs) : null;

  // Approaching cross: fast below slow rising toward it -> buy; above falling -> sell.
  const approaching = convergencePips > 0 ? (gapPips < 0 ? 'buy' : 'sell') : null;

  const setups = detectEmaCrossSetups(candles, {
    emaFast, emaSlow, direction: 'both',
  }, pip);
  // Only show past crosses in the same direction as the approaching one, so a
  // bullish row lists bullish crosses (and vice versa). If not converging, show
  // the most recent regardless of side.
  const relevant = approaching ? setups.filter(s => s.direction === approaching) : setups;
  const lastCrosses: ScannerCross[] = relevant
    .slice(-LAST_CROSSES)
    .reverse()
    .map(s => ({
      direction: s.direction,
      time: s.activationTime.toISOString(),
      mfePips: s.mfePrice !== null
        ? (s.direction === 'buy' ? (s.mfePrice - s.activationPrice) : (s.activationPrice - s.mfePrice)) / pip
        : null,
      maePips: s.maePrice !== null
        ? (s.direction === 'buy' ? (s.maePrice - s.activationPrice) : (s.activationPrice - s.maePrice)) / pip
        : null,
    }));

  return { symbol, gapPips, convergencePips, etaCandles, etaMs, approaching, lastCrosses };
}

export async function runScanner(
  broker: string, timeframe: string, emaFast: number, emaSlow: number,
): Promise<ScannerResult> {
  const symbolRows = await db.candle.findMany({
    where: { broker },
    distinct: ['symbol'],
    select: { symbol: true },
    orderBy: { symbol: 'asc' },
  });

  const rows: ScannerRow[] = [];
  for (const { symbol } of symbolRows) {
    const row = await evaluateSymbol(broker, symbol, timeframe, emaFast, emaSlow);
    if (row) rows.push(row);
  }

  // Sort by immediacy: converging first, soonest ETA on top.
  const byEta = (a: ScannerRow, b: ScannerRow) =>
    (a.etaCandles ?? Infinity) - (b.etaCandles ?? Infinity);

  const buys = rows.filter(r => r.approaching === 'buy').sort(byEta);
  const sells = rows.filter(r => r.approaching === 'sell').sort(byEta);
  return { buys, sells };
}
