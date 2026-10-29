import { useEffect, useMemo, useState } from 'react';
import { apiFetch, errorMessage } from '../../lib/api';
import { useLocalStorage } from '../../lib/useLocalStorage';
import { useTradesUpdated } from '../../lib/useTradesUpdated';
import { isBrokerVisible, useVisibility, visibleSymbols } from '../../lib/visibility';
import { dateRangeBounds, normalizeDateRange } from '../journal/utils/dateRange';
import { StatsFilters, type StatsFilterValues } from './StatsFilters';
import { StatsTotals } from './StatsTotals';
import { MonthlyBreakdown } from './MonthlyBreakdown';
import { BalanceChart } from './BalanceChart';
import type { BrokerStats } from './types';
import styles from './StatsPage.module.css';

interface StatsResult {
  key: string;
  stats?: BrokerStats;
  error?: string;
}

const DEFAULT_FILTERS: StatsFilterValues = { broker: '', symbol: '', dateRange: '', dateFrom: '', dateTo: '' };

export function StatsPage() {
  const [storedFilters, setFilters] = useLocalStorage<StatsFilterValues>('stats.filters', DEFAULT_FILTERS);
  const filters = useMemo(() => {
    const merged = { ...DEFAULT_FILTERS, ...storedFilters };
    return { ...merged, dateRange: normalizeDateRange(merged.dateRange) };
  }, [storedFilters]);

  const [allBrokers, setBrokers] = useState<string[]>([]);
  const visibility = useVisibility();
  const brokers = useMemo(() => allBrokers.filter(b => isBrokerVisible(visibility, b)), [allBrokers, visibility]);
  const [brokersError, setBrokersError] = useState('');
  const [result, setResult] = useState<StatsResult | null>(null);
  // Symbols traded on the broker, from the last stats response of that broker.
  const [symbolsByBroker, setSymbolsByBroker] = useState<Record<string, string[]>>({});

  useEffect(() => {
    apiFetch<{ broker: string }[]>('/balances')
      .then(rows => setBrokers([...new Set(rows.map(r => r.broker))].sort()))
      .catch(err => setBrokersError(errorMessage(err, 'Failed to load brokers')));
  }, []);

  const broker = brokers.includes(filters.broker) ? filters.broker : (brokers[0] ?? '');
  const knownSymbols = symbolsByBroker[broker];
  const symbols = useMemo(() => visibleSymbols(visibility, broker, knownSymbols ?? []), [visibility, broker, knownSymbols]);
  // An asset not traded on this broker (or hidden) falls back to Todos (AC 8).
  const symbol = filters.symbol && (!knownSymbols || symbols.includes(filters.symbol)) ? filters.symbol : '';
  const { from, to } = dateRangeBounds(filters);
  const requestKey = `${broker}|${symbol}|${from ?? ''}|${to ?? ''}`;
  // Not part of requestKey: the shown result stays until the refreshed one arrives.
  const refreshKey = useTradesUpdated(broker);

  useEffect(() => {
    if (!broker) return;
    let cancelled = false;
    const params = new URLSearchParams({ broker });
    if (symbol) params.set('symbol', symbol);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    apiFetch<BrokerStats>(`/stats?${params}`)
      .then(stats => {
        if (cancelled) return;
        setSymbolsByBroker(prev => ({ ...prev, [broker]: stats.symbols ?? [] }));
        setResult({ key: requestKey, stats });
      })
      .catch((err: unknown) => { if (!cancelled) setResult({ key: requestKey, error: errorMessage(err, 'Failed to load stats') }); });
    return () => { cancelled = true; };
  }, [broker, symbol, from, to, requestKey, refreshKey]);

  const current = result?.key === requestKey ? result : null;
  const error = brokersError || current?.error || '';
  const loading = !error && !current;
  const stats = current?.stats ?? null;
  const chartTitle = symbol ? `P&L acumulado · ${symbol}` : 'Balance';

  return (
    <div className={styles.page}>
      <StatsFilters
        brokers={brokers}
        symbols={symbols}
        values={{ ...filters, broker, symbol }}
        onChange={setFilters}
      />

      {error && <div className={styles.empty}>{error}</div>}
      {!error && loading && <div className={styles.empty}>Loading...</div>}

      {!error && !loading && stats && (
        <>
          <StatsTotals stats={{ ...stats, symbol: symbol || null }} />

          {stats.trades === 0 ? (
            <div className={styles.empty}>
              {filters.dateRange ? 'No trades in the selected period' : 'No closed trades for this broker'}
            </div>
          ) : (
            <div className={styles.split}>
              <BalanceChart curve={stats.curve} title={chartTitle} />
              <MonthlyBreakdown rows={stats.monthly} currency={stats.currency} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
