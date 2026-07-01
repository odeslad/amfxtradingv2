import { useEffect, useState } from 'react';
import { apiUrl } from '../../lib/api';

export interface EmaPoint {
  time: number;
  fast: number | null;
  slow: number | null;
}

interface RawEmaPoint {
  time: string;
  fast: number | null;
  slow: number | null;
}

// Fetch EMA series computed by the backend over the FULL history (same
// calculateEma the backtest uses), so the chart's lines and crosses match the
// setups exactly. Requested for the currently-loaded candle span [from, to].
export function useBacktestEmas(
  broker: string,
  symbol: string,
  timeframe: string,
  emaFast: number,
  emaSlow: number,
  from: number | undefined,
  to: number | undefined,
): EmaPoint[] {
  const [emas, setEmas] = useState<EmaPoint[]>([]);

  useEffect(() => {
    if (!broker || !symbol || !timeframe || from === undefined || to === undefined) {
      setEmas([]);
      return;
    }
    let cancelled = false;
    const url = apiUrl(
      `/candles/emas?broker=${encodeURIComponent(broker)}&symbol=${encodeURIComponent(symbol)}` +
      `&tf=${timeframe}&emaFast=${emaFast}&emaSlow=${emaSlow}&from=${from}&to=${to}`,
    );
    fetch(url, { credentials: 'include' })
      .then(r => r.json() as Promise<RawEmaPoint[]>)
      .then(data => {
        if (cancelled) return;
        setEmas(data.map(p => ({
          time: Math.floor(new Date(p.time).getTime() / 1000),
          fast: p.fast,
          slow: p.slow,
        })));
      })
      .catch(() => { if (!cancelled) setEmas([]); });
    return () => { cancelled = true; };
  }, [broker, symbol, timeframe, emaFast, emaSlow, from, to]);

  return emas;
}
