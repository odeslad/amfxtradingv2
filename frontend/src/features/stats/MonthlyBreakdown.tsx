import { useState } from 'react';
import { fmtPnl } from '../journal/utils/position';
import { fmtPct } from './format';
import type { MonthlyStats } from './types';
import styles from './MonthlyBreakdown.module.css';

interface MonthlyBreakdownProps {
  rows: MonthlyStats[];
  currency: string;
}

const PAGE_SIZE = 12;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const monthLabel = (month: string): string => {
  const [year, m] = month.split('-');
  return `${MONTH_LABELS[Number(m) - 1] ?? m} ${year}`;
};

const signClass = (n: number | null): string =>
  n === null || n === 0 ? styles.muted : n > 0 ? styles.profit : styles.loss;

const fmtCashFlow = (n: number, currency: string): string => (n === 0 ? '—' : fmtPnl(n, currency));

const fmtMonthPnl = (r: MonthlyStats, currency: string): string => (r.trades === 0 ? '—' : fmtPnl(r.netPnl, currency));

const fmtMonthReturn = (r: MonthlyStats): string => (r.trades === 0 ? '—' : fmtPct(r.returnPct));

export function MonthlyBreakdown({ rows, currency }: MonthlyBreakdownProps) {
  const [requestedPage, setRequestedPage] = useState(0);

  const newestFirst = [...rows].reverse();
  const pageCount = Math.max(1, Math.ceil(newestFirst.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount - 1);
  const visible = newestFirst.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className={styles.root}>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Month</th>
              <th>Trades</th>
              <th>Net P&amp;L</th>
              <th>Return</th>
              <th>Cash flow</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(r => (
              <tr key={r.month}>
                <td className={styles.month}>{monthLabel(r.month)}</td>
                <td className={r.trades === 0 ? styles.muted : undefined}>{r.trades}</td>
                <td className={signClass(r.trades === 0 ? 0 : r.netPnl)}>{fmtMonthPnl(r, currency)}</td>
                <td className={signClass(r.trades === 0 ? 0 : r.returnPct)}>{fmtMonthReturn(r)}</td>
                <td className={signClass(r.cashFlow)}>{fmtCashFlow(r.cashFlow, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.cards}>
        {visible.map(r => (
          <div key={r.month} className={styles.card}>
            <span className={styles.month}>{monthLabel(r.month)}</span>
            <span className={r.trades === 0 ? styles.muted : undefined}>{r.trades} trades</span>
            <span className={`${styles.cardPnl} ${signClass(r.trades === 0 ? 0 : r.netPnl)}`}>{fmtMonthPnl(r, currency)}</span>
            <span className={styles.cardLabel}>Return</span>
            <span className={`${styles.cardRight} ${signClass(r.trades === 0 ? 0 : r.returnPct)}`}>{fmtMonthReturn(r)}</span>
            <span className={styles.cardLabel}>Cash flow</span>
            <span className={`${styles.cardRight} ${signClass(r.cashFlow)}`}>{fmtCashFlow(r.cashFlow, currency)}</span>
          </div>
        ))}
      </div>

      {pageCount > 1 && (
        <div className={styles.pager}>
          <button
            type="button"
            className={styles.pagerBtn}
            disabled={page === 0}
            onClick={() => setRequestedPage(page - 1)}
          >
            ‹ Newer
          </button>
          <span className={styles.pagerInfo}>
            {monthLabel(visible[visible.length - 1].month)} – {monthLabel(visible[0].month)} · {page + 1}/{pageCount}
          </span>
          <button
            type="button"
            className={styles.pagerBtn}
            disabled={page >= pageCount - 1}
            onClick={() => setRequestedPage(page + 1)}
          >
            Older ›
          </button>
        </div>
      )}
    </div>
  );
}
