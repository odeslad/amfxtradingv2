import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { apiFetch } from '../../lib/api';
import { useWs } from '../../lib/useWs';
import { type Position, openTimeMs } from './utils/position';

interface LiveBrokerPositions {
  broker: string;
  currency: string;
  brokerOffset: number;
  positions: Position[];
}

export const posKey = (broker: string, ticket: number): string => `${broker}:${ticket}`;

// Open time parsed once per message instead of inside the sort comparator.
type LivePosition = Position & { openedAt: number };

const normalize = (p: Position, broker: string, currency?: string, brokerOffset?: number): LivePosition => ({
  ...p,
  broker: p.broker ?? broker,
  currency: p.currency ?? currency,
  brokerOffset: p.brokerOffset ?? brokerOffset,
  openedAt: openTimeMs(p.openTime),
});

const byBrokerThenTime = (a: LivePosition, b: LivePosition): number =>
  (a.broker ?? '').localeCompare(b.broker ?? '') || a.openedAt - b.openedAt;

// One string per list: the store changes only when something visible did (spec 019).
const signature = (list: Position[]): string =>
  list.map(p => `${p.ticket}|${p.type}|${p.lots}|${p.openPrice}|${p.sl}|${p.tp}|${p.profit}|${p.swap}|${p.currentBid}|${p.currentAsk}`).join(';');

// ── External store ──────────────────────────────────────────────────────────
// The live feed lives outside React state: the page that mounts the feed does
// not re-render per update, only the components that subscribe to it do.

export interface LiveSnapshot {
  positions: Position[];          // open positions and pending orders of every broker
  colors: Map<string, string>;    // posKey → colour
}

let snapshot: LiveSnapshot = { positions: [], colors: new Map() };
const listeners = new Set<() => void>();
const signatures = new Map<string, string>();

function publish(next: Partial<LiveSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  for (const l of listeners) l();
}

const subscribeStore = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

const getSnapshot = (): LiveSnapshot => snapshot;

export function setLiveColor(broker: string, ticket: number, color: string): void {
  const next = new Map(snapshot.colors);
  if (color) next.set(posKey(broker, ticket), color);
  else next.delete(posKey(broker, ticket));
  publish({ colors: next });
}

// Positions and colours of the feed; re-renders the caller on every accepted update.
export function useLivePositions(): LiveSnapshot {
  return useSyncExternalStore(subscribeStore, getSnapshot);
}

// The live rows behind a set of ticket keys (an open edit / cancel panel); null
// without keys. Re-renders only when those rows change.
export function useLivePositionsByKeys(keys: string[] | null): Position[] | null {
  const cache = useRef<{ sig: string; value: Position[] | null }>({ sig: '', value: null });
  const select = useCallback((): Position[] | null => {
    if (!keys) {
      if (cache.current.value !== null) cache.current = { sig: '', value: null };
      return null;
    }
    const rows = snapshot.positions.filter(p => keys.includes(posKey(p.broker!, p.ticket)));
    const sig = `${keys.join(',')}#${signature(rows)}`;
    if (sig !== cache.current.sig) cache.current = { sig, value: rows };
    return cache.current.value;
  }, [keys]);
  return useSyncExternalStore(subscribeStore, select);
}

// Runs the feed: one REST snapshot merged with the WebSocket `positions` stream.
// Mount it once (the Journal page); it holds no React state of its own.
export function useLivePositionsFeed(): void {
  // Brokers already refreshed by the WebSocket; the REST snapshot must not overwrite them.
  const wsBrokersRef = useRef(new Set<string>());

  useEffect(() => {
    const ac = new AbortController();
    apiFetch<LiveBrokerPositions[]>('/positions/live', { signal: ac.signal })
      .then((brokers) => {
        const colors = new Map(snapshot.colors);
        const fresh = brokers
          .filter(({ broker }) => !wsBrokersRef.current.has(broker))
          .flatMap(({ broker, currency, brokerOffset, positions: ps }) => {
            signatures.set(broker, signature(ps));
            return ps.map(p => {
              const pos = normalize(p, broker, currency, brokerOffset);
              if (pos.color) colors.set(posKey(pos.broker!, pos.ticket), pos.color);
              return pos;
            });
          });
        if (fresh.length === 0 && colors.size === snapshot.colors.size) return;
        const positions = [...(snapshot.positions as LivePosition[]), ...fresh].sort(byBrokerThenTime);
        publish({ positions, colors });
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);

  const handleWsMessage = useCallback((data: unknown) => {
    if (typeof data !== 'object' || data === null) return;
    const msg = data as { type: string; broker: string; currency?: string; brokerOffset?: number; positions: Position[] };
    if (msg.type !== 'positions') return;
    wsBrokersRef.current.add(msg.broker);
    const sig = signature(msg.positions);
    if (signatures.get(msg.broker) === sig) return;
    signatures.set(msg.broker, sig);
    const incoming = msg.positions.map(p => normalize(p, msg.broker, msg.currency, msg.brokerOffset));
    const withoutBroker = (snapshot.positions as LivePosition[]).filter(p => p.broker !== msg.broker);
    const positions = [...withoutBroker, ...incoming].sort(byBrokerThenTime);
    // Colours of tickets this broker no longer reports are dropped.
    const activeTickets = new Set(incoming.map(p => posKey(p.broker!, p.ticket)));
    let colors = snapshot.colors;
    for (const key of colors.keys()) {
      if (key.startsWith(`${msg.broker}:`) && !activeTickets.has(key)) {
        if (colors === snapshot.colors) colors = new Map(colors);
        colors.delete(key);
      }
    }
    publish({ positions, colors });
  }, []);

  useWs(handleWsMessage);
}
