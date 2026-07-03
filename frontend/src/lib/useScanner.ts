import { useState, useCallback } from 'react';
import { apiUrl } from './api';

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

export function useScanner() {
  const [result, setResult] = useState<ScannerResult>({ buys: [], sells: [] });
  const [loading, setLoading] = useState(false);

  const run = useCallback(async ({ broker, timeframe, emaFast, emaSlow }: ScannerParams) => {
    if (!broker) return;
    setLoading(true);
    try {
      const url = apiUrl(
        `/scanner?broker=${encodeURIComponent(broker)}&tf=${timeframe}&emaFast=${emaFast}&emaSlow=${emaSlow}`,
      );
      const res = await fetch(url, { credentials: 'include' });
      setResult(res.ok ? await res.json() as ScannerResult : { buys: [], sells: [] });
    } catch {
      setResult({ buys: [], sells: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, run };
}
