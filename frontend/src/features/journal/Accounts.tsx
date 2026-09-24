import { useEffect, useState, useCallback, useMemo } from 'react';
import { apiUrl } from '../../lib/api';
import { useWs } from '../../lib/useWs';
import { useSort, type SortColumn } from '../../lib/useSort';
import { fmt, currencySymbol } from './utils/position';
import { AccountCard } from './AccountCard';
import styles from './JournalPage.module.css';

interface Balance {
  id: number;
  broker: string;
  balance: number;
  equity: number;
  profit: number;
  margin: number;
  freeMargin: number;
  leverage: number;
  currency: string;
  name: string;
  number: number;
  timestamp: string;
}

const DAY_PNL_POLL_MS = 5000;

const dayPnlClass = (value: number): string =>
  value === 0 ? styles.muted : value > 0 ? styles.profit : styles.loss;

type ColumnKey =
  | 'broker' | 'name' | 'number' | 'balance' | 'equity' | 'profit'
  | 'dayPnl' | 'margin' | 'freeMargin' | 'leverage' | 'currency';

const buildColumns = (dayPnl: Record<string, number>): SortColumn<Balance, ColumnKey>[] => [
  { key: 'broker', label: 'Broker', value: b => b.broker },
  { key: 'name', label: 'Account', value: b => b.name },
  { key: 'number', label: 'Number', value: b => b.number },
  { key: 'balance', label: 'Balance', value: b => b.balance },
  { key: 'equity', label: 'Equity', value: b => b.equity },
  { key: 'profit', label: 'Profit', value: b => b.profit },
  { key: 'dayPnl', label: 'Day P&L', value: b => dayPnl[b.broker] },
  { key: 'margin', label: 'Margin', value: b => b.margin },
  { key: 'freeMargin', label: 'Free Margin', value: b => b.freeMargin },
  { key: 'leverage', label: 'Leverage', value: b => b.leverage },
  { key: 'currency', label: 'Currency', value: b => b.currency },
];

interface AccountsProps {
  onSelectBroker?: (broker: string) => void;
}

export function Accounts({ onSelectBroker }: AccountsProps) {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [dayPnl, setDayPnl] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(apiUrl('/balances'), { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load balances');
        return res.json() as Promise<Balance[]>;
      })
      .then(setBalances)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const fetchDayPnl = () => {
      fetch(apiUrl('/balances/daily-pnl'), { credentials: 'include' })
        .then(res => res.ok ? res.json() as Promise<Record<string, number>> : {})
        .then(setDayPnl)
        .catch(() => {});
    };
    fetchDayPnl();
    const id = setInterval(fetchDayPnl, DAY_PNL_POLL_MS);
    return () => clearInterval(id);
  }, []);

  const handleWsMessage = useCallback((data: unknown) => {
    if (typeof data !== 'object' || data === null) return;
    const msg = data as { type: string; broker: string; account: Balance };
    if (msg.type !== 'account') return;
    setBalances(prev => {
      const withoutBroker = prev.filter(b => b.broker !== msg.broker);
      return [...withoutBroker, { ...msg.account, broker: msg.broker }]
        .sort((a, b) => a.broker.localeCompare(b.broker));
    });
  }, []);

  useWs(handleWsMessage);

  const columns = useMemo(() => buildColumns(dayPnl), [dayPnl]);
  const { sorted, sort, toggle } = useSort(balances, columns, { key: 'broker', dir: 'asc' });

  if (loading) return <div className={styles.empty}>Loading...</div>;
  if (error) return <div className={styles.empty}>{error}</div>;
  if (balances.length === 0) return <div className={styles.empty}>No accounts</div>;

  return (
    <>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map(c => (
                <th
                  key={c.key}
                  className={`${styles.sortable} ${sort.key === c.key ? styles.sortActive : ''}`}
                  onClick={() => toggle(c.key)}
                  aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  {c.label}
                  {sort.key === c.key && <span className={styles.sortArrow}>{sort.dir === 'asc' ? '▲' : '▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(b => (
              <tr
                key={b.broker}
                className={[
                  onSelectBroker ? styles.accountRow : '',
                  dayPnl[b.broker] == null ? styles.inactiveRow : '',
                ].join(' ')}
                onDoubleClick={() => onSelectBroker?.(b.broker)}
                title={onSelectBroker ? 'Double-click to see positions' : undefined}
              >
                <td className={styles.broker}>{b.broker}</td>
                <td>{b.name}</td>
                <td>{b.number}</td>
                <td>{fmt(b.balance, 2)} {currencySymbol(b.currency)}</td>
                <td>{fmt(b.equity, 2)} {currencySymbol(b.currency)}</td>
                <td className={b.profit >= 0 ? styles.profit : styles.loss}>
                  {b.profit >= 0 ? '+' : ''}{fmt(b.profit, 2)} {currencySymbol(b.currency)}
                </td>
                <td className={dayPnl[b.broker] != null ? dayPnlClass(dayPnl[b.broker]) : styles.muted}>
                  {dayPnl[b.broker] != null
                    ? `${dayPnl[b.broker] >= 0 ? '+' : ''}${fmt(dayPnl[b.broker], 2)} ${currencySymbol(b.currency)}`
                    : '—'}
                </td>
                <td>{fmt(b.margin, 2)} {currencySymbol(b.currency)}</td>
                <td>{fmt(b.freeMargin, 2)} {currencySymbol(b.currency)}</td>
                <td>1:{b.leverage}</td>
                <td>{b.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.cards}>
        {sorted.map(b => (
          <AccountCard key={b.broker} balance={b} dayPnl={dayPnl[b.broker]} onSelect={onSelectBroker ? () => onSelectBroker(b.broker) : undefined} />
        ))}
      </div>
    </>
  );
}
