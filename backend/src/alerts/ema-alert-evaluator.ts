import type { TickData, TickBatch } from '../bridge/pipe-reader';
import { db } from '../db/client';
import { sendToUser } from '../services/push';
import { calculateEma, type Candle } from '../engine/indicators/ema';
import { getPipSize } from '../engine/pip-size';
import {
  getArmedEmaAlerts, hasAnyEmaAlerts, refreshEmaAlerts, type ArmedEmaAlert,
} from './ema-alert-store';

// Fires an alert when the fast/slow EMAs are CONVERGING (about to cross) at the
// close of a candle, within thresholdPips. "Anticipates" the cross by dynamics:
// the gap between EMAs is shrinking toward zero. Evaluated per timeframe on the
// tick stream, independent of the trading Engine.

type EmaAlertBroadcaster = (
  userId: number, broker: string, symbol: string, timeframe: string, direction: string,
) => void;
let broadcast: EmaAlertBroadcaster | null = null;
export function setEmaAlertBroadcaster(fn: EmaAlertBroadcaster): void {
  broadcast = fn;
}

const TF_FIELDS: Array<{ tf: string; field: keyof TickData }> = [
  { tf: 'M5', field: 'm5_time' },
  { tf: 'M15', field: 'm15_time' },
  { tf: 'H1', field: 'h1_time' },
  { tf: 'H4', field: 'h4_time' },
  { tf: 'D1', field: 'd1_time' },
];

// broker:symbol:tf -> last seen candle time, to detect a close (time changed).
const lastCandleTime = new Map<string, number>();

async function fire(alert: ArmedEmaAlert, crossDir: 'buy' | 'sell'): Promise<void> {
  await db.emaCrossAlert.update({
    where: { id: alert.id },
    data: { enabled: false, triggeredAt: new Date() },
  });
  await refreshEmaAlerts();
  broadcast?.(alert.userId, alert.broker, alert.symbol, alert.timeframe, crossDir);
  await sendToUser(alert.userId, {
    title: `${alert.symbol} EMA cross`,
    body: `${alert.symbol} (${alert.broker}) ${alert.timeframe}: EMA ${alert.emaFast}/${alert.emaSlow} converging (${crossDir})`,
    data: { broker: alert.broker, symbol: alert.symbol, timeframe: alert.timeframe, direction: crossDir },
  });
}

// Evaluate one alert against the closed candles of its symbol/timeframe.
async function evaluateAlert(alert: ArmedEmaAlert): Promise<void> {
  const need = Math.max(alert.emaFast, alert.emaSlow) + 2;
  const rows = await db.candle.findMany({
    where: { broker: alert.broker, symbol: alert.symbol, timeframe: alert.timeframe },
    orderBy: { time: 'desc' },
    take: Math.max(need, 200),
    select: { time: true, open: true, high: true, low: true, close: true },
  });
  if (rows.length < need) return;
  const candles = rows.reverse() as Candle[];

  const fast = calculateEma(candles, alert.emaFast);
  const slow = calculateEma(candles, alert.emaSlow);
  const n = candles.length;
  const fNow = fast[n - 1], sNow = slow[n - 1];
  const fPrev = fast[n - 2], sPrev = slow[n - 2];
  if (fNow === null || sNow === null || fPrev === null || sPrev === null) return;

  const pip = getPipSize(alert.symbol);
  const gapNow = (fNow - sNow) / pip;      // signed: >0 fast above slow
  const gapPrev = (fPrev - sPrev) / pip;

  // Converging = the absolute gap is shrinking toward a cross.
  const converging = Math.abs(gapNow) < Math.abs(gapPrev);
  const withinThreshold = Math.abs(gapNow) <= alert.thresholdPips;
  if (!converging || !withinThreshold) return;

  // Bullish cross approaching: fast below slow (gap<0) rising toward it.
  // Bearish cross approaching: fast above slow (gap>0) falling toward it.
  const crossDir: 'buy' | 'sell' = gapNow < 0 ? 'buy' : 'sell';
  if (alert.direction !== 'both' && alert.direction !== crossDir) return;

  await fire(alert, crossDir);
}

function onCandleClose(broker: string, symbol: string, timeframe: string): void {
  const alerts = getArmedEmaAlerts(broker, symbol).filter(a => a.timeframe === timeframe);
  for (const alert of alerts) {
    evaluateAlert(alert).catch(err =>
      console.error(`[EMA-ALERT] eval failed (id ${alert.id}):`, err));
  }
}

function trackTick(broker: string, tick: TickData): void {
  for (const { tf, field } of TF_FIELDS) {
    const current = tick[field] as number;
    const key = `${broker}:${tick.symbol}:${tf}`;
    const last = lastCandleTime.get(key);
    if (last !== undefined && current !== last) {
      onCandleClose(broker, tick.symbol, tf);
    }
    lastCandleTime.set(key, current);
  }
}

export function evaluateEmaAlerts(broker: string, batch: TickBatch): void {
  if (!hasAnyEmaAlerts()) {
    // Still track candle times so a close isn't missed right after arming.
    for (const tick of batch) {
      for (const { tf, field } of TF_FIELDS) {
        lastCandleTime.set(`${broker}:${tick.symbol}:${tf}`, tick[field] as number);
      }
    }
    return;
  }
  for (const tick of batch) trackTick(broker, tick);
}
