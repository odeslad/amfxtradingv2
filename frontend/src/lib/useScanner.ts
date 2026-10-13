import { useState, useCallback, useEffect, useRef } from 'react';
import { apiUrl, isAbortError } from './api';

export interface ScannerCross {
  direction: 'buy' | 'sell';
  time: string;
  mfePips: number | null;
  maePips: number | null;
}

export type ScannerState = 'imminent' | 'crossed' | 'na';

export interface ScannerRow {
  symbol: string;
  direction: 'buy' | 'sell';
  state: ScannerState;
  gapPips: number;
  convergencePips: number;
  etaCandles: number | null;
  etaMs: number | null;
  candlesSinceCross: number | null;
  activationClose: number | null;
  pipSize: number;
  lastCrosses: ScannerCross[];
}

export interface ScannerResult {
  buys: ScannerRow[];
  sells: ScannerRow[];
}

interface ScannerParams {
  broker: string;
  timeframe: string;
  emaFast: number;
  emaSlow: number;
}

const EMPTY_RESULT: ScannerResult = { buys: [], sells: [] };

export function useScanner() {
  const [result, setResult] = useState<ScannerResult>(EMPTY_RESULT);
  const [loading, setLoading] = useState(false);
  const acRef = useRef<AbortController | null>(null);

  useEffect(() => () => acRef.current?.abort(), []);

  const run = useCallback(async ({ broker, timeframe, emaFast, emaSlow }: ScannerParams) => {
    if (!broker) return;
    acRef.current?.abort();
    const ac = new AbortController();
    acRef.current = ac;
    setLoading(true);
    try {
      const url = apiUrl(
        `/scanner?broker=${encodeURIComponent(broker)}&tf=${timeframe}&emaFast=${emaFast}&emaSlow=${emaSlow}`,
      );
      const res = await fetch(url, { credentials: 'include', signal: ac.signal });
      const next = res.ok ? await res.json() as ScannerResult : EMPTY_RESULT;
      if (!ac.signal.aborted) setResult(next);
    } catch (err) {
      if (!isAbortError(err)) setResult(EMPTY_RESULT);
    } finally {
      if (acRef.current === ac) setLoading(false);
    }
  }, []);

  return { result, loading, run };
}
