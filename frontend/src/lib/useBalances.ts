import { useState, useEffect } from 'react';
import { apiFetch } from './api';

// Latest account balance per broker, keyed by broker name. Used by the '% Net'
// P&L mode to express P&L as a percentage of the account.
export type BalancesByBroker = Record<string, number>;

export function useBalances(): BalancesByBroker {
  const [balances, setBalances] = useState<BalancesByBroker>({});

  useEffect(() => {
    apiFetch<{ broker: string; balance: number }[]>('/balances')
      .then(data => setBalances(Object.fromEntries(data.map(b => [b.broker, b.balance]))))
      .catch(() => {});
  }, []);

  return balances;
}
