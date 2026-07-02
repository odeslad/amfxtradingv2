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

export type ScannerState = 'imminent' | 'crossed';

export interface ScannerRow {
  symbol: string;
  // 'buy' if approaching/just did a bullish cross, 'sell' otherwise. Decides panel.
  direction: 'buy' | 'sell';
  // 'imminent' = converging, not crossed yet; 'crossed' = crossed <= recentWithin.
  state: ScannerState;
  // Signed gap between fast and slow EMA in pips (>0 fast above slow).
  gapPips: number;
  // How fast the |gap| is shrinking per candle, in pips (>0 = converging).
  convergencePips: number;
  // Estimated candles until the cross (imminent), null otherwise.
  etaCandles: number | null;
  etaMs: number | null;
  // Candles since the last cross (crossed), null otherwise.
  candlesSinceCross: number | null;
  // Close price of the activation candle of the last cross (crossed), null otherwise.
  // The frontend uses it with the live bid to show real-time distance in pips.
  activationClose: number | null;
  pipSize: number;
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
  emaFast: number, emaSlow: number, recentWithin: number,
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
  const tfMs = getTimeframeMs(timeframe);

  const setups = detectEmaCrossSetups(candles, { emaFast, emaSlow, direction: 'both' }, pip);
  const lastSetup = setups.length > 0 ? setups[setups.length - 1] : null;
  // Count includes the still-forming candle (not yet in DB) so it matches the
  // live chart: (n-1) is the last CLOSED candle, +1 for the current forming one.
  const candlesSinceCross = lastSetup !== null ? ((n - 1) - lastSetup.activationIndex) + 1 : null;

  // A cross is "recently done" if it happened within the last `recentWithin`
  // candles. Otherwise the symbol is imminent (converging toward the next cross).
  const justCrossed = candlesSinceCross !== null && candlesSinceCross >= 1 && candlesSinceCross <= recentWithin;

  let state: ScannerState;
  let direction: 'buy' | 'sell';
  let etaCandles: number | null = null;

  if (justCrossed && lastSetup) {
    state = 'crossed';
    direction = lastSetup.direction; // the side of the cross just made
  } else {
    state = 'imminent';
    // Approaching side: fast below slow -> buy, above -> sell.
    direction = gapPips < 0 ? 'buy' : 'sell';
    etaCandles = convergencePips > 0 ? Math.abs(gapPips) / convergencePips : null;
  }
  const etaMs = etaCandles !== null ? Math.round(etaCandles * tfMs) : null;

  // Show past crosses matching this row's direction.
  const lastCrosses: ScannerCross[] = setups
    .filter(s => s.direction === direction)
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

  return {
    symbol, direction, state, gapPips, convergencePips,
    etaCandles, etaMs, candlesSinceCross: state === 'crossed' ? candlesSinceCross : null,
    activationClose: state === 'crossed' && lastSetup ? lastSetup.activationPrice : null,
    pipSize: pip,
    lastCrosses,
  };
}

export async function runScanner(
  broker: string, timeframe: string, emaFast: number, emaSlow: number, recentWithin: number,
): Promise<ScannerResult> {
  const symbolRows = await db.candle.findMany({
    where: { broker },
    distinct: ['symbol'],
    select: { symbol: true },
    orderBy: { symbol: 'asc' },
  });

  const rows: ScannerRow[] = [];
  for (const { symbol } of symbolRows) {
    const row = await evaluateSymbol(broker, symbol, timeframe, emaFast, emaSlow, recentWithin);
    if (row) rows.push(row);
  }

  // Order: imminent first (soonest ETA on top), then crossed (freshest first).
  const rank = (a: ScannerRow, b: ScannerRow) => {
    if (a.state !== b.state) return a.state === 'imminent' ? -1 : 1;
    if (a.state === 'imminent') return (a.etaCandles ?? Infinity) - (b.etaCandles ?? Infinity);
    return (a.candlesSinceCross ?? Infinity) - (b.candlesSinceCross ?? Infinity);
  };

  const buys = rows.filter(r => r.direction === 'buy').sort(rank);
  const sells = rows.filter(r => r.direction === 'sell').sort(rank);
  return { buys, sells };
}
