import { useCallback, useEffect, useRef, useState } from 'react';
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

const byBrokerThenTime = (a: Position, b: Position): number =>
  (a.broker ?? '').localeCompare(b.broker ?? '') || openTimeMs(a.openTime) - openTimeMs(b.openTime);

export interface LivePositions {
  positions: Position[];          // open positions and pending orders of every broker
  colors: Map<string, string>;    // posKey → colour
  setColor: (broker: string, ticket: number, color: string) => void;
}

// One REST snapshot merged with the WebSocket `positions` stream, shared by the
// Positions and Orders tabs so the feed and the colour map exist once.
export function useLivePositions(): LivePositions {
  const [positions, setPositions] = useState<Position[]>([]);
  const [colors, setColors] = useState<Map<string, string>>(new Map());

  const setColor = useCallback((broker: string, ticket: number, color: string) => {
    setColors(prev => {
      const next = new Map(prev);
      if (color) next.set(posKey(broker, ticket), color);
      else next.delete(posKey(broker, ticket));
      return next;
    });
  }, []);

  // Brokers already refreshed by the WebSocket; the REST snapshot must not overwrite them.
  const wsBrokersRef = useRef(new Set<string>());

  useEffect(() => {
    const ac = new AbortController();
    apiFetch<LiveBrokerPositions[]>('/positions/live', { signal: ac.signal })
      .then((brokers) => {
        const colorMap = new Map<string, string>();
        const fresh = brokers
          .filter(({ broker }) => !wsBrokersRef.current.has(broker))
          .flatMap(({ broker, currency, brokerOffset, positions: ps }) =>
            ps.map(p => {
              const pos = { ...p, broker: p.broker ?? broker, currency: p.currency ?? currency, brokerOffset: p.brokerOffset ?? brokerOffset };
              if (pos.color) colorMap.set(posKey(pos.broker!, pos.ticket), pos.color);
              return pos;
            })
          );
        if (colorMap.size > 0) setColors(prev => new Map([...prev, ...colorMap]));
        if (fresh.length > 0) setPositions(prev => [...prev, ...fresh].sort(byBrokerThenTime));
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);

  const handleWsMessage = useCallback((data: unknown) => {
    if (typeof data !== 'object' || data === null) return;
    const msg = data as { type: string; broker: string; currency?: string; brokerOffset?: number; positions: Position[] };
    if (msg.type !== 'positions') return;
    const incoming = msg.positions.map(p => ({
      ...p,
      broker: p.broker ?? msg.broker,
      currency: p.currency ?? msg.currency,
      brokerOffset: p.brokerOffset ?? msg.brokerOffset,
    }));
    wsBrokersRef.current.add(msg.broker);
    setPositions(prev => {
      const withoutBroker = prev.filter(p => p.broker !== msg.broker);
      return [...withoutBroker, ...incoming].sort(byBrokerThenTime);
    });
    // Colours of tickets this broker no longer reports are dropped.
    const activeTickets = new Set(incoming.map(p => posKey(p.broker!, p.ticket)));
    setColors(prev => {
      const next = new Map(prev);
      let changed = false;
      for (const key of next.keys()) {
        if (key.startsWith(`${msg.broker}:`) && !activeTickets.has(key)) {
          next.delete(key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  useWs(handleWsMessage);

  return { positions, colors, setColor };
}
