import { useCallback, useEffect, useRef, useState } from 'react';
import { useWs } from './useWs';

interface TradesUpdatedMessage {
  type: string;
  broker?: string;
}

const DEBOUNCE_MS = 1_000;

// A counter that grows when the backend stored new closed trades (spec 030):
// put it in a fetch effect's deps to refetch. Without `broker`, any broker counts.
export function useTradesUpdated(broker?: string): number {
  const [refreshKey, setRefreshKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  useWs(useCallback((data: unknown) => {
    const message = data as TradesUpdatedMessage;
    if (message.type !== 'trades_updated') return;
    if (broker && message.broker !== broker) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setRefreshKey(key => key + 1), DEBOUNCE_MS);
  }, [broker]));

  return refreshKey;
}
