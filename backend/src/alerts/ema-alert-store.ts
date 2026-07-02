import { db } from '../db/client';

// In-memory cache of armed EMA-cross alerts, mirrored from the DB. Read on every
// candle close, so it must be cheap. Routes call refresh() after any change.

export interface ArmedEmaAlert {
  id: number;
  userId: number;
  broker: string;
  symbol: string;
  timeframe: string;
  emaFast: number;
  emaSlow: number;
  direction: 'buy' | 'sell' | 'both';
  thresholdPips: number;
}

// broker -> symbol -> alerts
let byBrokerSymbol = new Map<string, Map<string, ArmedEmaAlert[]>>();

function index(alerts: ArmedEmaAlert[]): Map<string, Map<string, ArmedEmaAlert[]>> {
  const map = new Map<string, Map<string, ArmedEmaAlert[]>>();
  for (const a of alerts) {
    let symbols = map.get(a.broker);
    if (!symbols) { symbols = new Map(); map.set(a.broker, symbols); }
    const list = symbols.get(a.symbol);
    if (list) list.push(a); else symbols.set(a.symbol, [a]);
  }
  return map;
}

export async function refreshEmaAlerts(): Promise<void> {
  const rows = await db.emaCrossAlert.findMany({
    where: { enabled: true, triggeredAt: null },
    select: {
      id: true, userId: true, broker: true, symbol: true, timeframe: true,
      emaFast: true, emaSlow: true, direction: true, thresholdPips: true,
    },
  });
  byBrokerSymbol = index(rows.map(r => ({ ...r, direction: r.direction as 'buy' | 'sell' | 'both' })));
}

export function getArmedEmaAlerts(broker: string, symbol: string): ArmedEmaAlert[] {
  return byBrokerSymbol.get(broker)?.get(symbol) ?? [];
}

export function hasAnyEmaAlerts(): boolean {
  return byBrokerSymbol.size > 0;
}
