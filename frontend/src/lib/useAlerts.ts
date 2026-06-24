import { useState, useEffect, useCallback } from 'react';
import { apiUrl } from './api';

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

// Single source of truth for the user's price alerts, shared by the alerts panel
// and the chart overlay. Mutations refresh the list so both stay in sync.
export function useAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/alerts'), { credentials: 'include' });
      setAlerts(res.ok ? await res.json() as PriceAlert[] : []);
    } catch {
      setAlerts([]);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (alert: NewAlert) => {
    await fetch(apiUrl('/alerts'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert),
    });
    await refresh();
  }, [refresh]);

  const toggle = useCallback(async (a: PriceAlert) => {
    await fetch(apiUrl(`/alerts/${a.id}`), {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !a.enabled }),
    });
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: number) => {
    await fetch(apiUrl(`/alerts/${id}`), { method: 'DELETE', credentials: 'include' });
    await refresh();
  }, [refresh]);

  return { alerts, refresh, create, toggle, remove };
}
