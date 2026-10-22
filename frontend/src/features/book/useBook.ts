import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage, isAbortError } from '../../lib/api';
import {
  createScheme, createTrade, deleteScheme, deleteTrade, fetchBook, updateScheme, updateTrade,
  type BookPage, type PageSize, type SchemeInput, type TradeInput,
} from '../../lib/book';

// Data of the Schemas page: one page of the book for a year, with its totals.
// Every mutation refetches the page (the balance chain can move any row).

export function useBook() {
  const [year, setYear] = useState<number | 'all' | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [data, setData] = useState<BookPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const apply = useCallback((next: BookPage) => {
    setData(next);
    setError(null);
    setLoading(false);
  }, []);
  const fail = useCallback((err: unknown) => {
    if (isAbortError(err)) return;
    setError(errorMessage(err));
    setLoading(false);
  }, []);

  const load = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    return fetchBook(year, page, pageSize, { signal: controller.signal }).then(apply, fail);
  }, [year, page, pageSize, apply, fail]);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    fetchBook(year, page, pageSize, { signal: controller.signal }).then(apply, fail);
    return () => abortRef.current?.abort();
  }, [year, page, pageSize, apply, fail]);

  const selectYear = useCallback((next: number | 'all') => { setYear(next); setPage(1); }, []);
  const selectPageSize = useCallback((next: PageSize) => { setPageSize(next); setPage(1); }, []);

  const after = useCallback(async <T,>(run: () => Promise<T>): Promise<T> => {
    const result = await run();
    await load();
    return result;
  }, [load]);

  const actions = useMemo(() => ({
    createScheme: (input: SchemeInput) => after(() => createScheme(input)),
    updateScheme: (id: number, patch: Partial<SchemeInput>) => after(() => updateScheme(id, patch)),
    deleteScheme: (id: number) => after(() => deleteScheme(id)),
    createTrade: (input: TradeInput) => after(() => createTrade(input)),
    updateTrade: (id: number, patch: Partial<Omit<TradeInput, 'schemeId'>>) => after(() => updateTrade(id, patch)),
    deleteTrade: (id: number) => after(() => deleteTrade(id)),
  }), [after]);

  return { data, loading, error, year: data?.year ?? year, page, pageSize, selectYear, setPage, selectPageSize, refresh: load, actions };
}
