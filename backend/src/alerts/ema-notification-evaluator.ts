import type { TickData, TickBatch } from '../bridge/pipe-reader';
import { db } from '../db/client';
import { sendToUser } from '../services/push';
import { calculateEma, type Candle } from '../indicators/ema';
import { getPipSize } from '../indicators/pip-size';
import { decideFire, type FireDirection, type FireKind, type LastEvent } from './ema-notification-rules';
import { getActiveRules, hasAnyEmaNotifications, type ActiveRule } from './ema-notification-store';

// Evaluates the standing EMA notification rules (spec 023) at every candle close
// of a timeframe, detected on the tick stream exactly as the EMA alerts do.
// Independent of the chart's one-shot alerts; both consume the same batch.

export interface EmaNotificationFire {
  userId: number;
  notificationId: number;
  broker: string;
  symbol: string;
  timeframe: string;
  kind: FireKind;
  direction: FireDirection;
  gapPips: number;
  emaFast: number;
  emaSlow: number;
  note: string | null;
}

type Broadcaster = (fire: EmaNotificationFire) => void;
let broadcast: Broadcaster | null = null;
export function setEmaNotificationBroadcaster(fn: Broadcaster): void {
  broadcast = fn;
}

const TF_FIELDS: Array<{ tf: string; field: keyof TickData }> = [
  { tf: 'M5', field: 'm5_time' },
  { tf: 'M15', field: 'm15_time' },
  { tf: 'H1', field: 'h1_time' },
  { tf: 'H4', field: 'h4_time' },
  { tf: 'D1', field: 'd1_time' },
];

// broker:symbol:tf → last seen candle time, to detect a close (time changed).
const lastCandleTime = new Map<string, number>();
// rule:symbol → an approach was open at the previous close.
const approachOpen = new Map<string, boolean>();

const round1 = (v: number): number => Math.round(v * 10) / 10;

function title(fire: EmaNotificationFire): string {
  const side = fire.direction === 'buy' ? 'bullish' : 'bearish';
  return fire.kind === 'cross'
    ? `${fire.symbol} ${fire.timeframe} · ${side} cross`
    : `${fire.symbol} ${fire.timeframe} · ${side} approach (${round1(Math.abs(fire.gapPips))} p)`;
}

async function fire(rule: ActiveRule, symbol: string, kind: FireKind, direction: FireDirection, gapPips: number, candleTime: Date): Promise<void> {
  await db.emaNotificationEvent.create({
    data: { notificationId: rule.id, symbol, kind, direction, candleTime },
  });
  const payload: EmaNotificationFire = {
    userId: rule.userId, notificationId: rule.id, broker: rule.broker, symbol, timeframe: rule.timeframe,
    kind, direction, gapPips, emaFast: rule.emaFast, emaSlow: rule.emaSlow, note: rule.note,
  };
  broadcast?.(payload);
  await sendToUser(rule.userId, {
    title: title(payload),
    body: `${rule.broker} · EMA ${rule.emaFast}/${rule.emaSlow}${rule.note ? ` · ${rule.note}` : ''}`,
    data: { broker: rule.broker, symbol, timeframe: rule.timeframe, direction, kind, notificationId: rule.id },
  });
}

async function evaluateRule(rule: ActiveRule, symbol: string, candles: Candle[], pip: number): Promise<void> {
  const fast = calculateEma(candles, rule.emaFast);
  const slow = calculateEma(candles, rule.emaSlow);
  const n = candles.length;
  const fNow = fast[n - 1], sNow = slow[n - 1];
  const fPrev = fast[n - 2], sPrev = slow[n - 2];
  if (fNow === null || sNow === null || fPrev === null || sPrev === null) return;

  const gapNow = (fNow - sNow) / pip;
  const gapPrev = (fPrev - sPrev) / pip;
  const candleTime = candles[n - 1].time;
  const key = `${rule.id}:${symbol}`;

  const last = await db.emaNotificationEvent.findFirst({
    where: { notificationId: rule.id, symbol },
    orderBy: { firedAt: 'desc' },
    select: { kind: true, direction: true, candleTime: true, firedAt: true },
  });
  const lastEvent: LastEvent | null = last
    ? { kind: last.kind as FireKind, direction: last.direction as FireDirection, candleTime: last.candleTime, firedAt: last.firedAt }
    : null;

  const decision = decideFire(rule, gapNow, gapPrev, candleTime, lastEvent, approachOpen.get(key) ?? false, new Date());
  approachOpen.set(key, decision.approachOpen);
  if (decision.fire) await fire(rule, symbol, decision.fire.kind, decision.fire.direction, gapNow, candleTime);
}

async function onCandleClose(broker: string, symbol: string, timeframe: string): Promise<void> {
  const rules = getActiveRules(broker, timeframe, symbol);
  if (rules.length === 0) return;

  const need = Math.max(...rules.map(r => Math.max(r.emaFast, r.emaSlow))) + 2;
  const rows = await db.candle.findMany({
    where: { broker, symbol, timeframe },
    orderBy: { time: 'desc' },
    take: Math.max(need, 200),
    select: { time: true, open: true, high: true, low: true, close: true },
  });
  if (rows.length < need) return;
  const candles = rows.reverse() as Candle[];
  const pip = getPipSize(symbol);

  for (const rule of rules) {
    await evaluateRule(rule, symbol, candles, pip).catch(err =>
      console.error(`[EMA-NOTIF] eval failed (rule ${rule.id}, ${symbol}):`, err));
  }
}

function trackTick(broker: string, tick: TickData): void {
  for (const { tf, field } of TF_FIELDS) {
    const current = tick[field] as number;
    const key = `${broker}:${tick.symbol}:${tf}`;
    const last = lastCandleTime.get(key);
    if (last !== undefined && current !== last) {
      onCandleClose(broker, tick.symbol, tf).catch(err => console.error('[EMA-NOTIF] close failed:', err));
    }
    lastCandleTime.set(key, current);
  }
}

export function evaluateEmaNotifications(broker: string, batch: TickBatch): void {
  if (!hasAnyEmaNotifications()) {
    // Still track candle times so a close isn't missed right after a rule is created.
    for (const tick of batch) {
      for (const { tf, field } of TF_FIELDS) {
        lastCandleTime.set(`${broker}:${tick.symbol}:${tf}`, tick[field] as number);
      }
    }
    return;
  }
  for (const tick of batch) trackTick(broker, tick);
}
