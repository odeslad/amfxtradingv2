import { useSyncExternalStore } from 'react';
import { apiFetch } from './api';

export interface Visibility {
  hiddenBrokers: string[];
  hiddenSymbols: Record<string, string[]>;
}

export const EMPTY_VISIBILITY: Visibility = { hiddenBrokers: [], hiddenSymbols: {} };

// ── External store ──────────────────────────────────────────────────────────
// Loaded once per session from /settings and replaced when Settings saves, so
// every list that consults it re-renders without a reload (spec 024).

let snapshot: Visibility = EMPTY_VISIBILITY;
const listeners = new Set<() => void>();

const subscribeStore = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

const getSnapshot = (): Visibility => snapshot;

export function setVisibility(next: Visibility): void {
  snapshot = next;
  for (const l of listeners) l();
}

export function loadVisibility(signal?: AbortSignal): Promise<void> {
  return apiFetch<{ visibility?: Partial<Visibility> }>('/settings', { signal })
    .then(data => setVisibility({ ...EMPTY_VISIBILITY, ...data.visibility }))
    .catch(() => {});
}

export function useVisibility(): Visibility {
  return useSyncExternalStore(subscribeStore, getSnapshot, getSnapshot);
}

// ── Pure helpers ────────────────────────────────────────────────────────────

export const isBrokerVisible = (v: Visibility, broker: string): boolean =>
  !v.hiddenBrokers.includes(broker);

export const isSymbolVisible = (v: Visibility, broker: string, symbol: string): boolean =>
  !(v.hiddenSymbols[broker] ?? []).includes(symbol.toUpperCase());

export const visibleBrokers = <T extends { broker: string }>(v: Visibility, items: T[]): T[] =>
  items.filter(item => isBrokerVisible(v, item.broker));

export const visibleSymbols = (v: Visibility, broker: string, symbols: string[]): string[] =>
  symbols.filter(symbol => isSymbolVisible(v, broker, symbol));

export const isVisible = (v: Visibility, broker: string, symbol: string): boolean =>
  isBrokerVisible(v, broker) && isSymbolVisible(v, broker, symbol);
