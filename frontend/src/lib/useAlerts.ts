import { useCallback } from 'react';
import { apiSend } from './api';
import { useRemoteList } from './useRemoteList';

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
  const { items: alerts, refresh, mutate } = useRemoteList<PriceAlert>('/alerts');

  const create = useCallback((alert: NewAlert) =>
    mutate(() => apiSend('/alerts', 'POST', alert)), [mutate]);

  const toggle = useCallback((a: PriceAlert) =>
    mutate(() => apiSend(`/alerts/${a.id}`, 'PUT', { enabled: !a.enabled })), [mutate]);

  const remove = useCallback((id: number) =>
    mutate(() => apiSend(`/alerts/${id}`, 'DELETE')), [mutate]);

  return { alerts, refresh, create, toggle, remove };
}
