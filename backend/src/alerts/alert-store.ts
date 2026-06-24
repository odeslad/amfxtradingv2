import { db } from '../db/client';

// In-memory cache of armed price alerts, mirrored from the DB. Evaluated on every
// tick, so it must be cheap to read. The routes call refresh() after any change.

export interface ArmedAlert {
  id: number;
  userId: number;
  broker: string;
  symbol: string;
  price: number;
  direction: 'above' | 'below';
}

// broker -> symbol -> alerts
let byBrokerSymbol = new Map<string, Map<string, ArmedAlert[]>>();

function index(alerts: ArmedAlert[]): Map<string, Map<string, ArmedAlert[]>> {
  const map = new Map<string, Map<string, ArmedAlert[]>>();
  for (const a of alerts) {
    let symbols = map.get(a.broker);
    if (!symbols) { symbols = new Map(); map.set(a.broker, symbols); }
    const list = symbols.get(a.symbol);
    if (list) list.push(a); else symbols.set(a.symbol, [a]);
  }
  return map;
}

export async function refreshAlerts(): Promise<void> {
  const rows = await db.priceAlert.findMany({
    where: { enabled: true, triggeredAt: null },
    select: { id: true, userId: true, broker: true, symbol: true, price: true, direction: true },
  });
  byBrokerSymbol = index(rows.map(r => ({ ...r, direction: r.direction as 'above' | 'below' })));
}

export function getArmedAlerts(broker: string, symbol: string): ArmedAlert[] {
  return byBrokerSymbol.get(broker)?.get(symbol) ?? [];
}

export function hasAnyAlerts(): boolean {
  return byBrokerSymbol.size > 0;
}
