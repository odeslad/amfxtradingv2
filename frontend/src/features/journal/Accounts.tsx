import { useEffect, useState, useCallback } from 'react';
import { apiUrl } from '../../lib/api';
import { useWs } from '../../lib/useWs';
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

export function Accounts() {
  const [balances, setBalances] = useState<Balance[]>([]);
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

  if (loading) return <div className={styles.empty}>Loading...</div>;
  if (error) return <div className={styles.empty}>{error}</div>;
  if (balances.length === 0) return <div className={styles.empty}>No accounts</div>;

  return (
    <>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Broker</th>
              <th>Account</th>
              <th>Number</th>
              <th>Balance</th>
              <th>Equity</th>
              <th>Profit</th>
              <th>Margin</th>
              <th>Free Margin</th>
              <th>Leverage</th>
              <th>Currency</th>
            </tr>
          </thead>
          <tbody>
            {balances.map(b => (
              <tr key={b.broker}>
                <td className={styles.broker}>{b.broker}</td>
                <td>{b.name}</td>
                <td>{b.number}</td>
                <td>{fmt(b.balance, 2)} {currencySymbol(b.currency)}</td>
                <td>{fmt(b.equity, 2)} {currencySymbol(b.currency)}</td>
                <td className={b.profit >= 0 ? styles.profit : styles.loss}>
                  {b.profit >= 0 ? '+' : ''}{fmt(b.profit, 2)} {currencySymbol(b.currency)}
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
        {balances.map(b => (
          <AccountCard key={b.broker} balance={b} />
        ))}
      </div>
    </>
  );
}
