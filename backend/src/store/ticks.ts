interface TickPrice { bid: number; ask: number; }

const store = new Map<string, Map<string, TickPrice>>();

export function setTick(broker: string, symbol: string, bid: number, ask: number) {
  if (!store.has(broker)) store.set(broker, new Map());
  store.get(broker)!.set(symbol, { bid, ask });
}

export function getBid(broker: string, symbol: string): number | null {
  return store.get(broker)?.get(symbol)?.bid ?? null;
}

export function getAsk(broker: string, symbol: string): number | null {
  return store.get(broker)?.get(symbol)?.ask ?? null;
}

export function getAllBids(broker: string): Map<string, number> {
  const result = new Map<string, number>();
  store.get(broker)?.forEach((v, k) => result.set(k, v.bid));
  return result;
}
