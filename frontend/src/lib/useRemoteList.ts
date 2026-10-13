import { useState, useEffect, useCallback } from 'react';
import { apiFetch, isAbortError } from './api';

// A remote list with a refresh and a mutate helper that refreshes in `finally`.
// A failed load reads as an empty list; an aborted one leaves the state untouched.
export function useRemoteList<T>(path: string) {
  const [items, setItems] = useState<T[]>([]);

  const load = useCallback((signal?: AbortSignal) =>
    apiFetch<T[]>(path, { signal }).catch((err: unknown) => {
      if (isAbortError(err)) throw err;
      return [] as T[];
    }), [path]);

  const refresh = useCallback(() => load().then(setItems), [load]);

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal).then(setItems).catch(() => {});
    return () => ac.abort();
  }, [load]);

  const mutate = useCallback(async (action: () => Promise<unknown>) => {
    try {
      await action();
    } finally {
      await refresh();
    }
  }, [refresh]);

  return { items, refresh, mutate };
}
