import { useCallback } from 'react';
import { apiSend } from './api';
import { useRemoteList } from './useRemoteList';

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
  const { items: alerts, refresh, mutate } = useRemoteList<EmaCrossAlert>('/ema-alerts');

  const create = useCallback((alert: NewEmaAlert) =>
    mutate(() => apiSend('/ema-alerts', 'POST', alert)), [mutate]);

  const toggle = useCallback((a: EmaCrossAlert) =>
    mutate(() => apiSend(`/ema-alerts/${a.id}`, 'PUT', { enabled: !a.enabled })), [mutate]);

  const remove = useCallback((id: number) =>
    mutate(() => apiSend(`/ema-alerts/${id}`, 'DELETE')), [mutate]);

  return { alerts, refresh, create, toggle, remove };
}
