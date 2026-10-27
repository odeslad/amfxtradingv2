import { useState } from 'react';
import { fmt, fmtPnl } from '../journal/utils/position';
import type { MonthlyStats } from './types';
import styles from './MonthlyBreakdown.module.css';

interface MonthlyBreakdownProps {
  rows: MonthlyStats[];
  currency: string;
}

const PAGE_SIZE = 12;
const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const monthLabel = (month: string): string => {
  const [year, m] = month.split('-');
  return `${MONTH_LABELS[Number(m) - 1] ?? m} ${year}`;
};

const signClass = (n: number): string => (n === 0 ? styles.muted : n > 0 ? styles.profit : styles.loss);

const fmtMonthPnl = (r: MonthlyStats, currency: string): string => (r.trades === 0 ? '—' : fmtPnl(r.netPnl, currency));

const fmtWinPct = (r: MonthlyStats): string => (r.trades === 0 ? '—' : `${fmt((r.wins / r.trades) * 100, 1)} %`);

export function MonthlyBreakdown({ rows, currency }: MonthlyBreakdownProps) {
  const [requestedPage, setRequestedPage] = useState(0);

  const newestFirst = [...rows].reverse();
  const pageCount = Math.max(1, Math.ceil(newestFirst.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount - 1);
  const visible = newestFirst.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className={styles.root}>
      <div className={styles.header}><span className={styles.title}>Por mes</span></div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Mes</th>
              <th className={styles.num}>Trades</th>
              <th className={styles.num}>Win %</th>
              <th className={styles.num}>Net P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(r => (
              <tr key={r.month}>
                <td className={styles.month}>{monthLabel(r.month)}</td>
                <td className={`${styles.num} ${r.trades === 0 ? styles.muted : ''}`}>{r.trades}</td>
                <td className={`${styles.num} ${r.trades === 0 ? styles.muted : ''}`}>{fmtWinPct(r)}</td>
                <td className={`${styles.num} ${signClass(r.trades === 0 ? 0 : r.netPnl)}`}>{fmtMonthPnl(r, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.cards}>
        {visible.map(r => (
          <div key={r.month} className={styles.card}>
            <div className={styles.cardField}><span className={styles.cardLabel}>{monthLabel(r.month)}</span><span className={r.trades === 0 ? styles.muted : undefined}>{r.trades} trades</span></div>
            <div className={styles.cardField}><span className={styles.cardLabel}>Win</span><span className={r.trades === 0 ? styles.muted : undefined}>{fmtWinPct(r)}</span></div>
            <div className={`${styles.cardField} ${styles.cardRight}`}><span className={styles.cardLabel}>Net</span><span className={signClass(r.trades === 0 ? 0 : r.netPnl)}>{fmtMonthPnl(r, currency)}</span></div>
          </div>
        ))}
      </div>

      {pageCount > 1 && (
        <div className={styles.pager}>
          <button type="button" className={styles.pagerBtn} disabled={page === 0} onClick={() => setRequestedPage(page - 1)}>‹ Recientes</button>
          <span className={styles.pagerInfo}>{page + 1}/{pageCount}</span>
          <button type="button" className={styles.pagerBtn} disabled={page >= pageCount - 1} onClick={() => setRequestedPage(page + 1)}>Anteriores ›</button>
        </div>
      )}
    </div>
  );
}
