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

export type UpdateKind = 'initial' | 'older' | 'newer' | 'around';

// How the last candles update was produced, plus how many candles were
// trimmed from the opposite side, so the chart can keep the scroll steady.
export interface CandlesState {
  candles: Candle[];
  // 'initial'/'around' reset the view; 'older'/'newer' preserve it (the chart
  // re-anchors on the first visible candle's time, robust to trims).
  kind: UpdateKind;
  nonce: number;
}

interface Result {
  state: CandlesState;
  loadOlder: () => void;
  loadNewer: () => void;
  loadAround: (targetSec: number) => Promise<void>;
  hasOlder: boolean;
  hasNewer: boolean;
  loading: boolean;
}

const MAX = 2000;
const PAGE = 1000;
const TF_SECONDS: Record<string, number> = { M5: 300, M15: 900, H1: 3600, H4: 14400, D1: 86400 };

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
  const [state, setState] = useState<CandlesState>({ candles: [], kind: 'initial', nonce: 0 });
  const [hasOlder, setHasOlder] = useState(true);
  const [hasNewer, setHasNewer] = useState(false);
  const [loading, setLoading] = useState(false);

  const candlesRef = useRef<Candle[]>([]);
  useEffect(() => { candlesRef.current = state.candles; }, [state.candles]);
  const busyRef = useRef(false);
  const nonceRef = useRef(0);
  const hasOlderRef = useRef(true);
  const hasNewerRef = useRef(false);
  useEffect(() => { hasOlderRef.current = hasOlder; }, [hasOlder]);
  useEffect(() => { hasNewerRef.current = hasNewer; }, [hasNewer]);

  const base = useCallback(
    (extra: string) => apiUrl(`/candles?broker=${encodeURIComponent(broker)}&symbol=${encodeURIComponent(symbol)}&tf=${timeframe}&${extra}`),
    [broker, symbol, timeframe],
  );

  // Initial load: the MAX most recent candles.
  useEffect(() => {
    if (!broker || !symbol || !timeframe) { setState({ candles: [], kind: 'initial', nonce: ++nonceRef.current }); return; }
    setLoading(true);
    setHasNewer(false);
    setHasOlder(true);
    fetch(base(`limit=${MAX}`), { credentials: 'include' })
      .then(r => r.json() as Promise<RawCandle[]>)
      .then(data => {
        const parsed = parse(data);
        setState({ candles: parsed, kind: 'initial', nonce: ++nonceRef.current });
        setHasOlder(parsed.length >= MAX);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [base, broker, symbol, timeframe]);

  const loadOlder = useCallback(() => {
    if (busyRef.current || !hasOlderRef.current) return;
    const oldest = candlesRef.current[0]?.time;
    if (!oldest) return;
    busyRef.current = true;
    fetch(base(`limit=${PAGE}&before=${oldest}`), { credentials: 'include' })
      .then(r => r.json() as Promise<RawCandle[]>)
      .then(data => {
        if (data.length === 0) { setHasOlder(false); return; }
        const older = parse(data);
        setState(prev => {
          const merged = [...older, ...prev.candles];
          const trimmed = Math.max(0, merged.length - MAX);
          const windowed = trimmed > 0 ? merged.slice(0, merged.length - trimmed) : merged;
          return { candles: windowed, kind: 'older', nonce: ++nonceRef.current };
        });
        if (data.length < PAGE) setHasOlder(false);
        setHasNewer(true);
      })
      .catch(() => {})
      .finally(() => { busyRef.current = false; });
  }, [base]);

  const loadNewer = useCallback(() => {
    if (busyRef.current || !hasNewerRef.current) return;
    const newest = candlesRef.current[candlesRef.current.length - 1]?.time;
    if (!newest) return;
    busyRef.current = true;
    fetch(base(`limit=${PAGE}&after=${newest}`), { credentials: 'include' })
      .then(r => r.json() as Promise<RawCandle[]>)
      .then(data => {
        if (data.length === 0) { setHasNewer(false); return; }
        const newer = parse(data);
        setState(prev => {
          const merged = [...prev.candles, ...newer];
          const trimmed = Math.max(0, merged.length - MAX);
          const windowed = trimmed > 0 ? merged.slice(trimmed) : merged;
          return { candles: windowed, kind: 'newer', nonce: ++nonceRef.current };
        });
        if (data.length < PAGE) setHasNewer(false);
        setHasOlder(true);
      })
      .catch(() => {})
      .finally(() => { busyRef.current = false; });
  }, [base]);

  // Replace the window with MAX candles centered around a target time.
  const loadAround = useCallback(async (targetSec: number) => {
    if (!broker || !symbol || !timeframe) return;
    const tfSec = TF_SECONDS[timeframe.toUpperCase()] ?? 3600;
    const before = targetSec + tfSec * Math.floor(MAX / 2);
    try {
      const res = await fetch(base(`limit=${MAX}&before=${before}`), { credentials: 'include' });
      const data = (await res.json()) as RawCandle[];
      if (data.length === 0) return;
      const parsed = parse(data);
      setState({ candles: parsed, kind: 'around', nonce: ++nonceRef.current });
      setHasOlder(parsed.length >= MAX);
      setHasNewer(true);
    } catch {
      // ignore
    }
  }, [base, broker, symbol, timeframe]);

  return { state, loadOlder, loadNewer, loadAround, hasOlder, hasNewer, loading };
}
