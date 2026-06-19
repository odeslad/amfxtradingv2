import { useEffect, useState } from 'react';
import { apiUrl } from '../../lib/api';
import { type Trade, fmt, fmtPnl, fmtLocalTime, currencySymbol } from './utils/position';
import { type FilterValues, type FilterOptions } from './Filters';
import { TradeCard } from './TradeCard';
import styles from './JournalPage.module.css';

interface ClosedPositionsProps {
  filters: FilterValues;
  onOptionsChange: (options: FilterOptions) => void;
}

export function ClosedPositions({ filters, onOptionsChange }: ClosedPositionsProps) {
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

  useEffect(() => {
    const brokers = [...new Set(trades.map(t => t.broker).filter(Boolean))].sort();
    const symbols = [...new Set(trades.map(t => t.symbol).filter(Boolean))].sort();
    onOptionsChange({ brokers, symbols, colors: [] });
  }, [trades, onOptionsChange]);

  const filtered = trades.filter(t => {
    if (filters.broker && t.broker !== filters.broker) return false;
    if (filters.symbol && t.symbol !== filters.symbol) return false;
    if (filters.type === 'buy' && t.type !== 0) return false;
    if (filters.type === 'sell' && t.type !== 1) return false;
    return true;
  });

  if (loading) return <div className={styles.empty}>Loading...</div>;
  if (error) return <div className={styles.empty}>{error}</div>;
  if (trades.length === 0) return <div className={styles.empty}>No closed trades</div>;
  if (filtered.length === 0) return <div className={styles.empty}>No trades match the selected filters</div>;

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
              <th>SL</th>
              <th>TP</th>
              <th>Swap</th>
              <th>Commission</th>
              <th>P&amp;L</th>
              <th>Open Time</th>
              <th>Close Time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={`${t.broker}-${t.ticket}`}>
                <td className={styles.broker}>{t.broker}</td>
                <td className={t.type === 0 ? styles.buy : styles.sell}>{t.symbol}</td>
                <td>{fmt(t.lots, 2)}</td>
                <td>{fmt(t.openPrice, 5)}</td>
                <td>{fmt(t.closePrice, 5)}</td>
                <td>{t.sl ? fmt(t.sl, 5) : '—'}</td>
                <td>{t.tp ? fmt(t.tp, 5) : '—'}</td>
                <td className={t.swap < 0 ? styles.loss : t.swap > 0 ? styles.profit : undefined}>
                  {fmt(t.swap, 2)}{currencySymbol(t.currency) && ` ${currencySymbol(t.currency)}`}
                </td>
                <td className={t.commission < 0 ? styles.loss : t.commission > 0 ? styles.profit : styles.muted}>
                  {fmt(t.commission, 2)}{currencySymbol(t.currency) && ` ${currencySymbol(t.currency)}`}
                </td>
                <td className={t.profit >= 0 ? styles.profit : styles.loss}>
                  {fmtPnl(t.profit, t.currency)}
                </td>
                <td>{fmtLocalTime(t.openTime)}</td>
                <td>{fmtLocalTime(t.closeTime)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.cards}>
        {filtered.map(t => (
          <TradeCard key={`${t.broker}-${t.ticket}`} trade={t} />
        ))}
      </div>
    </>
  );
}
