import { useCallback, useEffect, useRef, useState } from 'react';
import { apiUrl } from '../../lib/api';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface RawCandle {
  openTime: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Result {
  candles: Candle[];
  loadMore: () => void;
  hasMore: boolean;
  loading: boolean;
}

function parse(data: RawCandle[]): Candle[] {
  return data
    .map(c => ({
      time: Math.floor(new Date(c.openTime).getTime() / 1000),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))
    .sort((a, b) => a.time - b.time);
}

export function useBacktestCandles(broker: string, symbol: string, timeframe: string): Result {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const candlesRef = useRef<Candle[]>([]);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);

  useEffect(() => { candlesRef.current = candles; }, [candles]);

  useEffect(() => {
    if (!broker || !symbol || !timeframe) { setCandles([]); return; }
    setCandles([]);
    setHasMore(true);
    hasMoreRef.current = true;
    setLoading(true);
    fetch(apiUrl(`/candles?broker=${encodeURIComponent(broker)}&symbol=${encodeURIComponent(symbol)}&tf=${timeframe}&limit=2000`), { credentials: 'include' })
      .then(r => r.json() as Promise<RawCandle[]>)
      .then(data => setCandles(parse(data)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [broker, symbol, timeframe]);

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !hasMoreRef.current || !broker || !symbol || !timeframe) return;
    const oldest = candlesRef.current[0]?.time;
    if (!oldest) return;
    loadingMoreRef.current = true;
    fetch(apiUrl(`/candles?broker=${encodeURIComponent(broker)}&symbol=${encodeURIComponent(symbol)}&tf=${timeframe}&limit=500&before=${oldest}`), { credentials: 'include' })
      .then(r => r.json() as Promise<RawCandle[]>)
      .then(data => {
        if (data.length === 0) { hasMoreRef.current = false; setHasMore(false); return; }
        setCandles(prev => [...parse(data), ...prev]);
      })
      .catch(() => {})
      .finally(() => { loadingMoreRef.current = false; });
  }, [broker, symbol, timeframe]);

  return { candles, loadMore, hasMore, loading };
}
