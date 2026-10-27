import { fmt, fmtPnl } from '../journal/utils/position';
import { fmtPct } from './format';
import type { BrokerStats } from './types';
import styles from './StatsTotals.module.css';

interface StatsTotalsProps {
  stats: BrokerStats;
}

const signClass = (n: number | null): string => (n === null || n === 0 ? '' : n > 0 ? styles.green : styles.red);

// The totals like the Schemes strip (spec 029): a strip on desktop, a block on the phone.
// With an asset selected cash flow shows "—" and the return is that asset's contribution.
export function StatsTotals({ stats }: StatsTotalsProps) {
  const asset = stats.symbol !== null;
  const winRate = stats.trades > 0 ? `${fmt((stats.wins / stats.trades) * 100, 1)} %` : '—';
  const cashFlow = asset || stats.cashFlow === 0 ? '—' : fmtPnl(stats.cashFlow, stats.currency);
  const returnPct = fmtPct(stats.returnPct);
  const returnClass = signClass(stats.returnPct);
  const net = fmtPnl(stats.netPnl, stats.currency);
  const tradesPerMonth = fmt(stats.tradesPerMonth, 1);
  // The account balance the return is measured against (also with an asset selected).
  const startBalance = stats.startBalance === null ? '—' : `${fmt(stats.startBalance, 2)} ${stats.currency}`.trim();

  return (
    <>
      <section aria-label="Totales" className={styles.strip}>
        <div className={styles.stat}><span className={styles.label}>Trades</span><span className={styles.value}>{stats.trades}</span></div>
        <div className={styles.stat}><span className={styles.label}>Win rate</span><span className={styles.value}>{winRate}</span></div>
        <div className={styles.stat}><span className={styles.label}>Trades / mes</span><span className={styles.value}>{tradesPerMonth}</span></div>
        <div className={styles.stat}><span className={styles.label}>Cash flow</span><span className={`${styles.value} ${asset ? styles.muted : signClass(stats.cashFlow)}`}>{cashFlow}</span></div>
        <div className={`${styles.stat} ${styles.push}`}><span className={styles.label}>Balance inicial</span><span className={styles.value}>{startBalance}</span></div>
        <div className={styles.stat}><span className={styles.label}>Return</span><span className={`${styles.value} ${styles.big} ${returnClass}`}>{returnPct}</span></div>
        <div className={styles.stat}><span className={styles.label}>Net P&amp;L</span><span className={`${styles.value} ${styles.big} ${signClass(stats.netPnl)}`}>{net}</span></div>
      </section>

      <section aria-label="Totales" className={styles.block}>
        <div className={styles.blockTop}>
          <div className={styles.field}><span className={styles.label}>Net P&amp;L</span><span className={`${styles.netBig} ${signClass(stats.netPnl)}`}>{net}</span></div>
          <div className={`${styles.field} ${styles.right}`}><span className={styles.label}>Return</span><span className={`${styles.returnBig} ${returnClass}`}>{returnPct}</span></div>
        </div>
        <div className={styles.blockRow}>
          <div className={styles.field}><span className={styles.label}>Trades</span><span className={styles.count}>{stats.trades}</span></div>
          <div className={styles.field}><span className={styles.label}>Win rate</span><span className={styles.count}>{winRate}</span></div>
          <div className={styles.field}><span className={styles.label}>Balance ini.</span><span className={styles.count}>{startBalance}</span></div>
          <div className={`${styles.field} ${styles.right}`}><span className={styles.label}>Cash flow</span><span className={`${styles.count} ${asset ? styles.muted : signClass(stats.cashFlow)}`}>{cashFlow}</span></div>
        </div>
      </section>
    </>
  );
}
