import { db } from '../db/client';
import type { NotificationDirection, NotificationEvent } from './ema-notification-rules';

// In-memory cache of the enabled, not yet ended EMA notification rules, indexed
// broker → timeframe. Routes call refresh() after any change; a minute timer
// refreshes it too so a rule stops at its end time without a request.

export interface ActiveRule {
  id: number;
  userId: number;
  broker: string;
  symbols: string[];          // empty = every symbol of the broker
  timeframe: string;
  emaFast: number;
  emaSlow: number;
  event: NotificationEvent;
  thresholdPips: number;
  direction: NotificationDirection;
  repeatMinutes: number | null;
  note: string | null;
}

let byBrokerTf = new Map<string, Map<string, ActiveRule[]>>();
let timer: NodeJS.Timeout | null = null;

export async function refreshEmaNotifications(): Promise<void> {
  const rows = await db.emaNotification.findMany({
    where: { enabled: true, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
    select: {
      id: true, userId: true, broker: true, symbols: true, timeframe: true, emaFast: true, emaSlow: true,
      event: true, thresholdPips: true, direction: true, repeatMinutes: true, note: true,
    },
  });
  const map = new Map<string, Map<string, ActiveRule[]>>();
  for (const r of rows) {
    const rule: ActiveRule = { ...r, event: r.event as NotificationEvent, direction: r.direction as NotificationDirection };
    let tfs = map.get(r.broker);
    if (!tfs) { tfs = new Map(); map.set(r.broker, tfs); }
    const list = tfs.get(r.timeframe);
    if (list) list.push(rule); else tfs.set(r.timeframe, [rule]);
  }
  byBrokerTf = map;
}

export function getActiveRules(broker: string, timeframe: string, symbol: string): ActiveRule[] {
  const rules = byBrokerTf.get(broker)?.get(timeframe) ?? [];
  return rules.filter(r => r.symbols.length === 0 || r.symbols.includes(symbol));
}

export function hasAnyEmaNotifications(): boolean {
  return byBrokerTf.size > 0;
}

// Keeps the cache honest about end times; idempotent.
export function startEmaNotificationRefresh(intervalMs = 60_000): void {
  if (timer) return;
  timer = setInterval(() => {
    refreshEmaNotifications().catch(err => console.error('[EMA-NOTIF] refresh failed:', err));
  }, intervalMs);
  timer.unref();
}

export function stopEmaNotificationRefresh(): void {
  if (timer) { clearInterval(timer); timer = null; }
}
