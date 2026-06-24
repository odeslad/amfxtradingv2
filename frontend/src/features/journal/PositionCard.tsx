import { useRef, useState, type TouchEvent } from 'react';
import { type Position, type PnlMode, fmt, fmtPnlMode, calcPnl, currentQuote, fmtLocalTime, currencySymbol } from './utils/position';
import { ColorBadge } from './ColorBadge';
import styles from './PositionCard.module.css';

const SWIPE_THRESHOLD = 50;
const TAP_TOLERANCE = 8;
const DOUBLE_TAP_MS = 300;

interface PositionCardProps {
  position: Position;
  pnlMode: PnlMode;
  balance?: number;
  color?: string;
  onColorChange: (broker: string, ticket: number, color: string) => void;
  onEdit: (p: Position) => void;
  onClose: (p: Position) => void;
  onOpenChart?: (p: Position) => void;
}

export function PositionCard({ position: p, pnlMode, balance, color, onColorChange, onEdit, onClose, onOpenChart }: PositionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(false);

  const startX = useRef(0);
  const lastDx = useRef(0);
  const moved = useRef(false);
  const lastTapTime = useRef(0);

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
    if (open) { setOpen(false); return; }

    const now = Date.now();
    if (now - lastTapTime.current < DOUBLE_TAP_MS) {
      onOpenChart?.(p);
      lastTapTime.current = 0;
      return;
    }
    lastTapTime.current = now;
    setExpanded(prev => !prev);
  };

  const pnlValue = calcPnl(p, pnlMode, balance);

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

        <div
          role="button"
          tabIndex={0}
          className={`${styles.summary} ${expanded ? styles.summaryActive : ''}`}
          onClick={onSummaryClick}
          onDoubleClick={() => onOpenChart?.(p)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSummaryClick(); }}
          aria-expanded={expanded}
        >
          <span className={styles.label}>Symbol</span>
          <span className={styles.label}>Open</span>
          <span className={`${styles.label} ${styles.right}`}>P&amp;L</span>

          <span className={styles.symbolCell}>
            <ColorBadge broker={p.broker!} ticket={p.ticket} color={color} onColorChange={onColorChange} />
            <span className={p.type === 0 ? styles.buy : styles.sell}>{p.symbol}</span>
          </span>
          <span className={styles.value}>{fmt(p.openPrice, 5)}</span>
          <span className={`${pnlValue >= 0 ? styles.profit : styles.loss} ${styles.right} ${styles.pnl}`}>
            {fmtPnlMode(p, pnlMode, balance)}
          </span>
        </div>
      </div>

      {expanded && (
        <div className={styles.details}>
          <div className={styles.field}>
            <span className={styles.label}>Price</span>
            <span>{currentQuote(p) != null ? fmt(currentQuote(p)!, 5) : '—'}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Lots</span>
            <span>{fmt(p.lots, 2)}</span>
          </div>
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
          <div className={styles.field}>
            <span className={styles.label}>Broker</span>
            <span className={styles.brokerName}>{p.broker}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Open Time</span>
            <span className={styles.date}>{fmtLocalTime(p.openTime, p.brokerOffset)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
