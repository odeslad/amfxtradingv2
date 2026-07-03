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

export type ScannerState = 'imminent' | 'crossed' | 'na';

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

// Returns one row per direction (buy and sell) for a symbol, so every pair is
// visible in both panels: the Buys row carries its bullish situation/crosses,
// the Sells row its bearish ones.
async function evaluateSymbolBothSides(
  broker: string, symbol: string, timeframe: string,
  emaFast: number, emaSlow: number,
): Promise<ScannerRow[]> {
  const need = Math.max(emaFast, emaSlow) + 5;
  const rows = await db.candle.findMany({
    where: { broker, symbol, timeframe },
    orderBy: { time: 'desc' },
    take: MAX_CANDLES,
    select: { time: true, open: true, high: true, low: true, close: true },
  });
  if (rows.length < need) return [];
  const candles = rows.reverse() as Candle[];

  const pip = getPipSize(symbol);
  const fast = calculateEma(candles, emaFast);
  const slow = calculateEma(candles, emaSlow);
  const n = candles.length;
  const fNow = fast[n - 1], sNow = slow[n - 1];
  const fPrev = fast[n - 2], sPrev = slow[n - 2];
  if (fNow === null || sNow === null || fPrev === null || sPrev === null) return [];

  const gapPips = (fNow - sNow) / pip;       // >0 fast above slow (bullish position)
  const gapPrev = (fPrev - sPrev) / pip;
  const convergencePips = Math.abs(gapPrev) - Math.abs(gapPips);
  const tfMs = getTimeframeMs(timeframe);
  const converging = convergencePips > 0;

  const setups = detectEmaCrossSetups(candles, { emaFast, emaSlow, direction: 'both' }, pip);
  const lastSetup = setups.length > 0 ? setups[setups.length - 1] : null;
  const candlesSinceCross = lastSetup !== null ? ((n - 1) - lastSetup.activationIndex) + 1 : null;

  const dirSetups = (dir: 'buy' | 'sell') => setups.filter(s => s.direction === dir);

  const buildRow = (direction: 'buy' | 'sell'): ScannerRow => {
    const dSetups = dirSetups(direction);
    const lastDirSetup = dSetups.length > 0 ? dSetups[dSetups.length - 1] : null;
    const candlesSinceCross = lastDirSetup !== null ? ((n - 1) - lastDirSetup.activationIndex) + 1 : null;
    // State is defined by the EMA position for THIS panel's direction:
    // buy: fast above slow = crossed (bullish); fast below slow converging =
    //   imminent (bullish cross approaching); fast below slow not converging = na.
    // sell: mirrored.
    const inFavour = direction === 'buy' ? gapPips > 0 : gapPips < 0; // fast on this side
    let state: ScannerState;
    let etaCandles: number | null = null;

    if (inFavour) {
      // EMAs already on this side: the cross of this direction has happened.
      state = 'crossed';
    } else if (converging) {
      // EMAs on the opposite side but closing in: cross of this direction is near.
      state = 'imminent';
      etaCandles = Math.abs(gapPips) / convergencePips;
    } else {
      // Opposite side and diverging: not this direction.
      state = 'na';
    }
    const etaMs = etaCandles !== null ? Math.round(etaCandles * tfMs) : null;

    const lastCrosses: ScannerCross[] = dSetups
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
      symbol, direction, state,
      gapPips, convergencePips, etaCandles, etaMs,
      candlesSinceCross: state === 'crossed' ? candlesSinceCross : null,
      activationClose: state === 'crossed' && lastDirSetup ? lastDirSetup.activationPrice : null,
      pipSize: pip,
      lastCrosses,
    };
  };

  return [buildRow('buy'), buildRow('sell')];
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
    const pair = await evaluateSymbolBothSides(broker, symbol, timeframe, emaFast, emaSlow);
    rows.push(...pair);
  }

  // Order: imminent first (soonest ETA), then crossed (freshest), then na.
  const stateOrder: Record<ScannerState, number> = { imminent: 0, crossed: 1, na: 2 };
  const rank = (a: ScannerRow, b: ScannerRow) => {
    if (a.state !== b.state) return stateOrder[a.state] - stateOrder[b.state];
    if (a.state === 'imminent') return (a.etaCandles ?? Infinity) - (b.etaCandles ?? Infinity);
    if (a.state === 'crossed') return (a.candlesSinceCross ?? Infinity) - (b.candlesSinceCross ?? Infinity);
    return a.symbol.localeCompare(b.symbol); // na: alphabetical
  };

  const buys = rows.filter(r => r.direction === 'buy').sort(rank);
  const sells = rows.filter(r => r.direction === 'sell').sort(rank);
  return { buys, sells };
}
