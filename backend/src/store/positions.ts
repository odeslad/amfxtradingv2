interface BrokerPositions {
  positions: unknown[];
  currency: string;
  brokerOffset: number;
}

const store = new Map<string, BrokerPositions>();

export function setPositions(broker: string, positions: unknown[], currency: string, brokerOffset: number) {
  store.set(broker, { positions, currency, brokerOffset });
}

export function getAllPositions() {
  return Array.from(store.entries()).map(([broker, data]) => ({ broker, ...data }));
}
