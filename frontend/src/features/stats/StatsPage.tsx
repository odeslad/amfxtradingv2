import { useEffect, useMemo, useState } from 'react';
import { apiFetch, errorMessage } from '../../lib/api';
import { useLocalStorage } from '../../lib/useLocalStorage';
import { isBrokerVisible, useVisibility } from '../../lib/visibility';
import { dateRangeBounds } from '../journal/utils/dateRange';
import { fmt, fmtPnl } from '../journal/utils/position';
import { StatsFilters, type StatsFilterValues } from './StatsFilters';
import { StatTile, type StatTone } from './StatTile';
import { MonthlyBreakdown } from './MonthlyBreakdown';
import { BalanceChart } from './BalanceChart';
import { fmtPct } from './format';
import type { BrokerStats } from './types';
import styles from './StatsPage.module.css';

interface StatsResult {
  key: string;
  stats?: BrokerStats;
  error?: string;
}

const DEFAULT_FILTERS: StatsFilterValues = { broker: '', dateRange: '', dateFrom: '', dateTo: '' };

const toneOf = (n: number): StatTone => (n > 0 ? 'positive' : n < 0 ? 'negative' : 'neutral');

export function StatsPage() {
  const [storedFilters, setFilters] = useLocalStorage<StatsFilterValues>('stats.filters', DEFAULT_FILTERS);
  const filters = useMemo(() => ({ ...DEFAULT_FILTERS, ...storedFilters }), [storedFilters]);

  const [allBrokers, setBrokers] = useState<string[]>([]);
  const visibility = useVisibility();
  const brokers = useMemo(() => allBrokers.filter(b => isBrokerVisible(visibility, b)), [allBrokers, visibility]);
  const [brokersError, setBrokersError] = useState('');
  const [result, setResult] = useState<StatsResult | null>(null);

  useEffect(() => {
    apiFetch<{ broker: string }[]>('/balances')
      .then(rows => setBrokers([...new Set(rows.map(r => r.broker))].sort()))
      .catch(err => setBrokersError(errorMessage(err, 'Failed to load brokers')));
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
    apiFetch<BrokerStats>(`/stats?${params}`)
      .then(stats => { if (!cancelled) setResult({ key: requestKey, stats }); })
      .catch((err: unknown) => { if (!cancelled) setResult({ key: requestKey, error: errorMessage(err, 'Failed to load stats') }); });
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
            />
            <StatTile label="Net P&L" value={fmtPnl(stats.netPnl, stats.currency)} tone={toneOf(stats.netPnl)} />
            <StatTile
              label="Cash flow"
              value={stats.cashFlow === 0 ? '—' : fmtPnl(stats.cashFlow, stats.currency)}
              tone={toneOf(stats.cashFlow)}
            />
            <StatTile label="Trades" value={String(stats.trades)} />
            <StatTile label="Win rate" value={winRate === null ? '—' : `${fmt(winRate, 1)} %`} />
          </div>

          {stats.trades === 0 ? (
            <div className={styles.empty}>
              {filters.dateRange ? 'No trades in the selected period' : 'No closed trades for this broker'}
            </div>
          ) : (
            <div className={styles.split}>
              <MonthlyBreakdown rows={stats.monthly} currency={stats.currency} />
              <div className={styles.chartPane}>
                <BalanceChart curve={stats.curve} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
