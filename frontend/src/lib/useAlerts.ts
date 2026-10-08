import { useState, useEffect, useCallback } from 'react';
import { apiUrl, errorFrom } from './api';

export interface PriceAlert {
  id: number;
  broker: string;
  symbol: string;
  price: number;
  direction: 'above' | 'below';
  note: string | null;
  enabled: boolean;
  triggeredAt: string | null;
}

export interface NewAlert {
  broker: string;
  symbol: string;
  price: number;
  direction: 'above' | 'below';
}

// A failed load reads as an empty list, as before.
function loadAlerts(): Promise<PriceAlert[]> {
  return fetch(apiUrl('/alerts'), { credentials: 'include' })
    .then(res => (res.ok ? (res.json() as Promise<PriceAlert[]>) : []))
    .catch((): PriceAlert[] => []);
}

// Single source of truth for the user's price alerts, shared by the alerts panel
// and the chart overlay. Mutations refresh the list so both stay in sync.
export function useAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);

  const refresh = useCallback(() => loadAlerts().then(setAlerts), []);

  useEffect(() => {
    loadAlerts().then(setAlerts);
  }, []);

  const create = useCallback(async (alert: NewAlert) => {
    try {
      const res = await fetch(apiUrl('/alerts'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert),
      });
      if (!res.ok) throw new Error(await errorFrom(res));
    } finally {
      await refresh();
    }
  }, [refresh]);

  const toggle = useCallback(async (a: PriceAlert) => {
    try {
      const res = await fetch(apiUrl(`/alerts/${a.id}`), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !a.enabled }),
      });
      if (!res.ok) throw new Error(await errorFrom(res));
    } finally {
      await refresh();
    }
  }, [refresh]);

  const remove = useCallback(async (id: number) => {
    try {
      const res = await fetch(apiUrl(`/alerts/${id}`), { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error(await errorFrom(res));
    } finally {
      await refresh();
    }
  }, [refresh]);

  return { alerts, refresh, create, toggle, remove };
}
