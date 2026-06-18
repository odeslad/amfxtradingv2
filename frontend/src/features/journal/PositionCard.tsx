import { useState } from 'react';
import { type Position, fmt, fmtPnl, fmtDate } from './position';
import styles from './PositionCard.module.css';

interface PositionCardProps {
  position: Position;
}

export function PositionCard({ position: p }: PositionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => setExpanded(prev => !prev);

  return (
    <div className={styles.card}>
      <button
        type="button"
        className={styles.summary}
        onClick={toggle}
        aria-expanded={expanded}
      >
        <span className={styles.label}>Symbol</span>
        <span className={styles.label}>Open</span>
        <span className={styles.label}>Lots</span>
        <span className={`${styles.label} ${styles.right}`}>P&amp;L</span>

        <span className={p.type === 0 ? styles.buy : styles.sell}>{p.symbol}</span>
        <span className={styles.value}>{fmt(p.openPrice, 5)}</span>
        <span className={styles.value}>{fmt(p.lots, 2)}</span>
        <span className={`${p.profit >= 0 ? styles.profit : styles.loss} ${styles.right}`}>
          {fmtPnl(p.profit, p.currency)}
        </span>
      </button>

      {expanded && (
        <div className={styles.details}>
          <div className={styles.field}>
            <span className={styles.label}>SL</span>
            <span className={styles.muted}>{p.sl ? fmt(p.sl, 5) : '—'}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>TP</span>
            <span className={styles.muted}>{p.tp ? fmt(p.tp, 5) : '—'}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Swap</span>
            <span className={p.swap < 0 ? styles.loss : styles.muted}>{fmt(p.swap, 2)}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Commission</span>
            <span className={p.commission < 0 ? styles.loss : styles.muted}>{fmt(p.commission, 2)}</span>
          </div>
          <div className={styles.fieldWide}>
            <span className={styles.label}>{p.broker}</span>
            <span className={styles.muted}>{fmtDate(p.openTime)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
