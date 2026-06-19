interface AccountInfo {
  balance: number;
  currency: string;
}

const store = new Map<string, AccountInfo>();

export function setAccount(broker: string, info: AccountInfo) {
  store.set(broker, info);
}

export function getAccount(broker: string): AccountInfo | null {
  return store.get(broker) ?? null;
}
