import { useState, useEffect, useCallback } from 'react';
import { apiUrl } from './api';

export type EmaAlertDirection = 'buy' | 'sell' | 'both';

export interface EmaCrossAlert {
  id: number;
  broker: string;
  symbol: string;
  timeframe: string;
  emaFast: number;
  emaSlow: number;
  direction: EmaAlertDirection;
  thresholdPips: number;
  note: string | null;
  enabled: boolean;
  triggeredAt: string | null;
}

export interface NewEmaAlert {
  broker: string;
  symbol: string;
  timeframe: string;
  emaFast: number;
  emaSlow: number;
  direction: EmaAlertDirection;
  thresholdPips: number;
}

// Source of truth for the user's EMA-cross alerts, mirroring useAlerts. Mutations
// refresh the list so the panel stays in sync.
export function useEmaAlerts() {
  const [alerts, setAlerts] = useState<EmaCrossAlert[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/ema-alerts'), { credentials: 'include' });
      setAlerts(res.ok ? await res.json() as EmaCrossAlert[] : []);
    } catch {
      setAlerts([]);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (alert: NewEmaAlert) => {
    await fetch(apiUrl('/ema-alerts'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert),
    });
    await refresh();
  }, [refresh]);

  const toggle = useCallback(async (a: EmaCrossAlert) => {
    await fetch(apiUrl(`/ema-alerts/${a.id}`), {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !a.enabled }),
    });
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: number) => {
    await fetch(apiUrl(`/ema-alerts/${id}`), { method: 'DELETE', credentials: 'include' });
    await refresh();
  }, [refresh]);

  return { alerts, refresh, create, toggle, remove };
}
