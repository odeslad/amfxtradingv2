import { useCallback } from 'react';
import { apiSend } from './api';
import { useRemoteList } from './useRemoteList';

export type NotificationEvent = 'cross' | 'approach' | 'both';
export type NotificationDirection = 'buy' | 'sell' | 'both';
export type NotificationState = 'active' | 'paused' | 'ended';
export const TIMEFRAMES = ['M5', 'M15', 'H1', 'H4', 'D1'] as const;

export interface EmaNotification {
  id: number;
  broker: string;
  symbols: string[];            // empty = every symbol of the broker
  timeframe: string;
  emaFast: number;
  emaSlow: number;
  event: NotificationEvent;
  thresholdPips: number;
  direction: NotificationDirection;
  repeatMinutes: number | null; // null = once per event
  endsAt: string | null;
  enabled: boolean;
  note: string | null;
  createdAt: string;
  state: NotificationState;
  lastFired: { symbol: string; kind: 'cross' | 'approach'; direction: 'buy' | 'sell'; firedAt: string } | null;
}

export interface NotificationInput {
  broker: string;
  symbols: string[];
  timeframe: string;
  emaFast: number;
  emaSlow: number;
  event: NotificationEvent;
  thresholdPips: number;
  direction: NotificationDirection;
  repeatMinutes: number | null;
  endsAt: string | null;
  note: string | null;
}

export const eventLabel = (n: Pick<EmaNotification, 'event' | 'thresholdPips'>): string =>
  n.event === 'cross' ? 'Confirmed cross'
    : n.event === 'approach' ? `Approach ≤ ${n.thresholdPips} p`
      : `Cross + approach ≤ ${n.thresholdPips} p`;

export const directionLabel = (d: NotificationDirection): string =>
  d === 'buy' ? 'Bullish' : d === 'sell' ? 'Bearish' : 'Both';

export const repeatLabel = (m: number | null): string =>
  m === null ? 'Once per event' : `Every ${m} min`;

export const symbolsLabel = (symbols: string[]): string =>
  symbols.length === 0 ? 'All symbols' : symbols.join(' · ');

// The user's standing EMA notification rules; every mutation refreshes the list.
export function useEmaNotifications() {
  const { items, refresh, mutate } = useRemoteList<EmaNotification>('/ema-notifications');

  const create = useCallback((input: NotificationInput) =>
    mutate(() => apiSend('/ema-notifications', 'POST', input)), [mutate]);

  const update = useCallback((id: number, input: Partial<NotificationInput> & { enabled?: boolean }) =>
    mutate(() => apiSend(`/ema-notifications/${id}`, 'PUT', input)), [mutate]);

  const toggle = useCallback((n: EmaNotification) =>
    mutate(() => apiSend(`/ema-notifications/${n.id}`, 'PUT', { enabled: !n.enabled })), [mutate]);

  const remove = useCallback((id: number) =>
    mutate(() => apiSend(`/ema-notifications/${id}`, 'DELETE')), [mutate]);

  return { notifications: items, refresh, create, update, toggle, remove };
}
