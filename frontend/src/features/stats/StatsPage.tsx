import { useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../../lib/api';
import { useLocalStorage } from '../../lib/useLocalStorage';
import { dateRangeBounds } from '../journal/utils/dateRange';
import { fmt, fmtPnl } from '../journal/utils/position';
import { StatsFilters, type StatsFilterValues } from './StatsFilters';
import { StatTile, type StatTone } from './StatTile';
import { MonthlyBreakdown } from './MonthlyBreakdown';
import type { BrokerStats } from './types';
import styles from './StatsPage.module.css';

interface StatsResult {
  key: string;
  stats?: BrokerStats;
  error?: string;
}

const DEFAULT_FILTERS: StatsFilterValues = { broker: '', dateRange: '', dateFrom: '', dateTo: '' };
const DERIVED_HINT = 'Assumes no deposits or withdrawals in the period';

const toneOf = (n: number): StatTone => (n > 0 ? 'positive' : n < 0 ? 'negative' : 'neutral');

const fmtPct = (n: number | null): string => (n === null ? '—' : `${n >= 0 ? '+' : ''}${fmt(n, 2)} %`);

export function StatsPage() {
  const [storedFilters, setFilters] = useLocalStorage<StatsFilterValues>('stats.filters', DEFAULT_FILTERS);
  const filters = useMemo(() => ({ ...DEFAULT_FILTERS, ...storedFilters }), [storedFilters]);

  const [brokers, setBrokers] = useState<string[]>([]);
  const [brokersError, setBrokersError] = useState('');
  const [result, setResult] = useState<StatsResult | null>(null);

  useEffect(() => {
    fetch(apiUrl('/balances'), { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load brokers');
        return res.json() as Promise<{ broker: string }[]>;
      })
      .then(rows => setBrokers([...new Set(rows.map(r => r.broker))].sort()))
      .catch(err => setBrokersError(err.message));
  }, []);

  const broker = brokers.includes(filters.broker) ? filters.broker : (brokers[0] ?? '');
  const { from, to } = dateRangeBounds(filters);
  const requestKey = `${broker}|${from ?? ''}|${to ?? ''}`;

  useEffect(() => {
    if (!broker) return;
    let cancelled = false;
    const params = new URLSearchParams({ broker });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    fetch(apiUrl(`/stats?${params}`), { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load stats');
        return res.json() as Promise<BrokerStats>;
      })
      .then(stats => { if (!cancelled) setResult({ key: requestKey, stats }); })
      .catch((err: Error) => { if (!cancelled) setResult({ key: requestKey, error: err.message }); });
    return () => { cancelled = true; };
  }, [broker, from, to, requestKey]);

  const current = result?.key === requestKey ? result : null;
  const error = brokersError || current?.error || '';
  const loading = !error && !current;
  const stats = current?.stats ?? null;
  const winRate = stats && stats.trades > 0 ? (stats.wins / stats.trades) * 100 : null;

  return (
    <div className={styles.page}>
      <StatsFilters
        brokers={brokers}
        values={{ ...filters, broker }}
        onChange={setFilters}
      />

      {error && <div className={styles.empty}>{error}</div>}
      {!error && loading && <div className={styles.empty}>Loading...</div>}

      {!error && !loading && stats && (
        <>
          <div className={styles.tiles}>
            <StatTile label="Trades / month" value={fmt(stats.tradesPerMonth, 1)} />
            <StatTile
              label="Return"
              value={fmtPct(stats.returnPct)}
              tone={stats.returnPct === null ? 'neutral' : toneOf(stats.returnPct)}
              hint={stats.startBalanceSource === 'derived' ? DERIVED_HINT : undefined}
            />
            <StatTile label="Net P&L" value={fmtPnl(stats.netPnl, stats.currency)} tone={toneOf(stats.netPnl)} />
            <StatTile label="Trades" value={String(stats.trades)} />
            <StatTile label="Win rate" value={winRate === null ? '—' : `${fmt(winRate, 1)} %`} />
          </div>

          {stats.trades === 0 ? (
            <div className={styles.empty}>
              {filters.dateRange ? 'No trades in the selected period' : 'No closed trades for this broker'}
            </div>
          ) : (
            <MonthlyBreakdown rows={stats.monthly} currency={stats.currency} />
          )}
        </>
      )}
    </div>
  );
}
