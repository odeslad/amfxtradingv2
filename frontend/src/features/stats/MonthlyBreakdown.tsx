import { fmtPnl } from '../journal/utils/position';
import type { MonthlyStats } from './types';
import styles from './MonthlyBreakdown.module.css';

interface MonthlyBreakdownProps {
  rows: MonthlyStats[];
  currency: string;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const monthLabel = (month: string): string => {
  const [year, m] = month.split('-');
  return `${MONTH_LABELS[Number(m) - 1] ?? m} ${year}`;
};

const pnlClass = (n: number): string => (n > 0 ? styles.profit : n < 0 ? styles.loss : styles.muted);

export function MonthlyBreakdown({ rows, currency }: MonthlyBreakdownProps) {
  return (
    <>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Month</th>
              <th>Trades</th>
              <th>Net P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.month}>
                <td className={styles.month}>{monthLabel(r.month)}</td>
                <td className={r.trades === 0 ? styles.muted : undefined}>{r.trades}</td>
                <td className={pnlClass(r.netPnl)}>{fmtPnl(r.netPnl, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.cards}>
        {rows.map(r => (
          <div key={r.month} className={styles.card}>
            <span className={styles.month}>{monthLabel(r.month)}</span>
            <span className={r.trades === 0 ? styles.muted : undefined}>{r.trades} trades</span>
            <span className={`${styles.cardPnl} ${pnlClass(r.netPnl)}`}>{fmtPnl(r.netPnl, currency)}</span>
          </div>
        ))}
      </div>
    </>
  );
}
