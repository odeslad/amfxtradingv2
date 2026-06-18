import { useRef, useState, type TouchEvent } from 'react';
import { type Position, fmt, fmtPnl, fmtLocalTime, currencySymbol } from './position';
import styles from './PositionCard.module.css';

const SWIPE_THRESHOLD = 50;
const TAP_TOLERANCE = 8;

interface PositionCardProps {
  position: Position;
  onEdit: (p: Position) => void;
  onClose: (p: Position) => void;
}

export function PositionCard({ position: p, onEdit, onClose }: PositionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(false);

  const startX = useRef(0);
  const lastDx = useRef(0);
  const moved = useRef(false);

  const onTouchStart = (e: TouchEvent) => {
    startX.current = e.touches[0].clientX;
    lastDx.current = 0;
    moved.current = false;
  };

  const onTouchMove = (e: TouchEvent) => {
    lastDx.current = e.touches[0].clientX - startX.current;
    if (Math.abs(lastDx.current) > TAP_TOLERANCE) moved.current = true;
  };

  const onTouchEnd = () => {
    if (lastDx.current < -SWIPE_THRESHOLD) setOpen(true);
    else if (lastDx.current > SWIPE_THRESHOLD) setOpen(false);
  };

  const onSummaryClick = () => {
    if (moved.current) return;
    if (open) {
      setOpen(false);
      return;
    }
    setExpanded(prev => !prev);
  };

  return (
    <div className={`${styles.card} ${expanded ? styles.cardExpanded : ''}`}>
      <div
        className={styles.swipeRow}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className={styles.actions}>
          <div className={`${styles.actionsInner} ${open ? styles.actionsInnerOpen : ''} ${expanded ? styles.actionsInnerExpanded : ''}`}>
            <button type="button" className={styles.editBtn} onClick={() => onEdit(p)}>Edit</button>
            <button type="button" className={styles.closeBtn} onClick={() => onClose(p)}>Close</button>
          </div>
        </div>

        <button
          type="button"
          className={`${styles.summary} ${expanded ? styles.summaryActive : ''}`}
          onClick={onSummaryClick}
          aria-expanded={expanded}
        >
          <span className={styles.label}>Symbol</span>
          <span className={styles.label}>Open</span>
          <span className={styles.label}>Lots</span>
          <span className={`${styles.label} ${styles.right}`}>P&amp;L</span>

          <span className={p.type === 0 ? styles.buy : styles.sell}>{p.symbol}</span>
          <span className={styles.value}>{fmt(p.openPrice, 5)}</span>
          <span className={styles.value}>{fmt(p.lots, 2)}</span>
          <span className={`${p.profit >= 0 ? styles.profit : styles.loss} ${styles.right} ${styles.pnl}`}>
            {fmtPnl(p.profit, p.currency)}
          </span>
        </button>
      </div>

      {expanded && (
        <div className={styles.details}>
          <div className={styles.field}>
            <span className={styles.label}>SL</span>
            <span>{p.sl ? fmt(p.sl, 5) : '—'}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>TP</span>
            <span>{p.tp ? fmt(p.tp, 5) : '—'}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Swap</span>
            <span className={p.swap < 0 ? styles.loss : undefined}>{fmt(p.swap, 2)}{currencySymbol(p.currency) && ` ${currencySymbol(p.currency)}`}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Commission</span>
            <span className={p.commission < 0 ? styles.loss : styles.muted}>{fmt(p.commission, 2)}{currencySymbol(p.currency) && ` ${currencySymbol(p.currency)}`}</span>
          </div>
          <div className={styles.fieldWide}>
            <span className={styles.brokerName}>{p.broker}</span>
            <span className={styles.date}>{fmtLocalTime(p.openTime, p.brokerOffset)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
