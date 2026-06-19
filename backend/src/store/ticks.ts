const store = new Map<string, Map<string, number>>();

export function setTick(broker: string, symbol: string, bid: number) {
  if (!store.has(broker)) store.set(broker, new Map());
  store.get(broker)!.set(symbol, bid);
}

export function getBid(broker: string, symbol: string): number | null {
  return store.get(broker)?.get(symbol) ?? null;
}

export function getAllBids(broker: string): Map<string, number> {
  return store.get(broker) ?? new Map();
}
