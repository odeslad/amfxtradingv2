import { useEffect, useState } from 'react';
import { apiUrl } from '../../lib/api';
import { type Trade, fmt, fmtPnl, fmtLocalTime } from './utils/position';
import styles from './JournalPage.module.css';

export function ClosedPositions() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(apiUrl('/trades'), { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load trades');
        return res.json() as Promise<Trade[]>;
      })
      .then(setTrades)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.empty}>Loading...</div>;
  if (error) return <div className={styles.empty}>{error}</div>;
  if (trades.length === 0) return <div className={styles.empty}>No closed trades</div>;

  return (
    <>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Broker</th>
              <th>Symbol</th>
              <th>Lots</th>
              <th>Open Price</th>
              <th>Close Price</th>
              <th>Swap</th>
              <th>Commission</th>
              <th>P&amp;L</th>
              <th>Open Time</th>
              <th>Close Time</th>
            </tr>
          </thead>
          <tbody>
            {trades.map(t => (
              <tr key={`${t.broker}-${t.ticket}`}>
                <td className={styles.broker}>{t.broker}</td>
                <td className={t.type === 0 ? styles.buy : styles.sell}>{t.symbol}</td>
                <td>{fmt(t.lots, 2)}</td>
                <td>{fmt(t.openPrice, 5)}</td>
                <td>{fmt(t.closePrice, 5)}</td>
                <td className={t.swap < 0 ? styles.loss : t.swap > 0 ? styles.profit : undefined}>
                  {fmt(t.swap, 2)}
                </td>
                <td className={t.commission < 0 ? styles.loss : t.commission > 0 ? styles.profit : styles.muted}>
                  {fmt(t.commission, 2)}
                </td>
                <td className={t.profit >= 0 ? styles.profit : styles.loss}>
                  {fmtPnl(t.profit)}
                </td>
                <td>{fmtLocalTime(t.openTime)}</td>
                <td>{fmtLocalTime(t.closeTime)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.cards}>
        {trades.map(t => (
          <div key={`${t.broker}-${t.ticket}`} className={styles.tradeCard}>
            <div className={styles.tradeCardHeader}>
              <span className={t.type === 0 ? styles.buy : styles.sell}>{t.symbol}</span>
              <span className={t.profit >= 0 ? styles.profit : styles.loss}>{fmtPnl(t.profit)}</span>
            </div>
            <div className={styles.tradeCardRow}>
              <span className={styles.tradeLabel}>Open</span>
              <span>{fmt(t.openPrice, 5)}</span>
              <span className={styles.tradeLabel}>Close</span>
              <span>{fmt(t.closePrice, 5)}</span>
            </div>
            <div className={styles.tradeCardRow}>
              <span className={styles.tradeLabel}>Lots</span>
              <span>{fmt(t.lots, 2)}</span>
              <span className={styles.tradeLabel}>Broker</span>
              <span className={styles.broker}>{t.broker}</span>
            </div>
            <div className={styles.tradeCardFooter}>
              <span>{fmtLocalTime(t.openTime)}</span>
              <span>{fmtLocalTime(t.closeTime)}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
