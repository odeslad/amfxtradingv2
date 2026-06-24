import type { TickData, TickBatch } from '../bridge/pipe-reader';
import { db } from '../db/client';
import { sendToUser } from '../services/push';
import { getArmedAlerts, hasAnyAlerts, refreshAlerts } from './alert-store';

// Evaluates armed price alerts on every tick. A "cross" is detected by comparing
// the previous bid to the current one, so the alert fires only the moment the
// price moves through the level — not on every tick while it sits past it.
//
// This module is independent of the trading Engine; it just taps the same tick
// stream from index.ts.

// broker -> symbol -> last bid seen
const lastBid = new Map<string, Map<string, number>>();

function getLastBid(broker: string, symbol: string): number | undefined {
  return lastBid.get(broker)?.get(symbol);
}

function setLastBid(broker: string, symbol: string, bid: number): void {
  let symbols = lastBid.get(broker);
  if (!symbols) { symbols = new Map(); lastBid.set(broker, symbols); }
  symbols.set(symbol, bid);
}

function crossed(direction: 'above' | 'below', prev: number, curr: number, level: number): boolean {
  if (direction === 'above') return prev < level && curr >= level;
  return prev > level && curr <= level;
}

async function fire(alert: { id: number; userId: number; broker: string; symbol: string; price: number }): Promise<void> {
  // One-shot: disable and timestamp before notifying so a burst of ticks can't
  // double-fire while the push is in flight.
  await db.priceAlert.update({
    where: { id: alert.id },
    data: { enabled: false, triggeredAt: new Date() },
  });
  await refreshAlerts();
  await sendToUser(alert.userId, {
    title: `${alert.symbol} alert`,
    body: `${alert.symbol} (${alert.broker}) reached ${alert.price}`,
    data: { broker: alert.broker, symbol: alert.symbol, price: alert.price },
  });
}

function evaluateTick(broker: string, tick: TickData): void {
  const { symbol, bid } = tick;
  const prev = getLastBid(broker, symbol);
  setLastBid(broker, symbol, bid);
  if (prev === undefined) return; // need a previous value to detect a cross

  const alerts = getArmedAlerts(broker, symbol);
  for (const alert of alerts) {
    if (crossed(alert.direction, prev, bid, alert.price)) {
      fire(alert).catch(err => console.error(`[ALERT] fire failed (id ${alert.id}):`, err));
    }
  }
}

export function evaluateAlerts(broker: string, batch: TickBatch): void {
  if (!hasAnyAlerts()) {
    // still track last bid so a cross isn't missed right after an alert is armed
    for (const tick of batch) setLastBid(broker, tick.symbol, tick.bid);
    return;
  }
  for (const tick of batch) evaluateTick(broker, tick);
}
