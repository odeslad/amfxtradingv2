import { useEffect, useState } from 'react';
import { apiFetch, isAbortError } from '../../lib/api';
import type { EmaTradesSettings } from './emaTrades';

// One EMA-cross trade for the chart overlay (spec 039). Times in epoch seconds.
export interface EmaCrossTrade {
  index: number;
  direction: 'buy' | 'sell';
  startTime: number;
  endTime: number;
  entry: number;
  sl: number | null;
  riskPips: number | null;
  pipSize: number;
}

interface SetupRow {
  direction: 'buy' | 'sell';
  activationTime: string;
  closeTime: string | null;
  levels: { ECC: number; EVL: number | null };
  pipSize: number;
}

const toSeconds = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

const TF_SECONDS: Record<string, number> = { M5: 300, M15: 900, H1: 3600, H4: 14400, D1: 86400 };

// Entry = cross-candle close ± the offset in the trade direction; the lines last until the
// next opposite cross or the configured number of candles, whichever comes first.
export function toEmaCrossTrades(setups: SetupRow[], timeframe: string, settings: EmaTradesSettings): EmaCrossTrade[] {
  const tfSeconds = TF_SECONDS[timeframe] ?? 3600;
  return setups.map((s, index) => {
    const offset = settings.entryPips * s.pipSize;
    const entry = s.direction === 'buy' ? s.levels.ECC + offset : s.levels.ECC - offset;
    const startTime = toSeconds(s.activationTime);
    const capTime = startTime + settings.candles * tfSeconds;
    const endTime = s.closeTime ? Math.min(toSeconds(s.closeTime), capTime) : capTime;
    const sl = s.levels.EVL;
    return {
      index: index + 1,
      direction: s.direction,
      startTime,
      endTime,
      entry,
      sl,
      riskPips: sl === null ? null : Math.abs(entry - sl) / s.pipSize,
      pipSize: s.pipSize,
    };
  });
}

// Fetches the last N setups while the overlay is on; refetches when the selection, the
// settings or the last closed candle change.
export function useEmaCrossTrades(
  enabled: boolean,
  broker: string,
  symbol: string,
  timeframe: string,
  settings: EmaTradesSettings,
  lastClosedTime: number | null,
): EmaCrossTrade[] {
  // The result carries the key it was fetched for, so a stale list is never shown for a
  // new selection while its request is in flight.
  const [result, setResult] = useState<{ key: string; trades: EmaCrossTrade[] }>({ key: '', trades: [] });
  const { fast, slow, entryPips, candles, count } = settings;
  const active = enabled && Boolean(broker) && Boolean(symbol);
  const key = `${broker}|${symbol}|${timeframe}|${fast}|${slow}|${entryPips}|${candles}|${count}|${lastClosedTime ?? ''}`;

  useEffect(() => {
    if (!active) return;
    const ac = new AbortController();
    const query = `broker=${encodeURIComponent(broker)}&symbol=${encodeURIComponent(symbol)}&tf=${timeframe}`
      + `&emaFast=${fast}&emaSlow=${slow}&limit=${count}`;
    apiFetch<{ setups?: SetupRow[] }>(`/setup-levels?${query}`, { signal: ac.signal })
      .then(data => setResult({ key, trades: toEmaCrossTrades(data.setups ?? [], timeframe, { fast, slow, entryPips, candles, count }) }))
      .catch(err => { if (!isAbortError(err)) setResult({ key, trades: [] }); });
    return () => ac.abort();
  }, [active, key, broker, symbol, timeframe, fast, slow, entryPips, candles, count]);

  return active && result.key === key ? result.trades : EMPTY;
}

const EMPTY: EmaCrossTrade[] = [];
