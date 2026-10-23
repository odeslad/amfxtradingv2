import { type Position, fmt, fmtDistance, fmtLocalTime, isBuySide, orderDistancePips, TYPE_LABEL } from './utils/position';
import { useSwipeActions } from './utils/useSwipeActions';
import { ColorBadge } from './ColorBadge';
import styles from './PositionCard.module.css';
import own from './OrderCard.module.css';

interface OrderCardProps {
  order: Position;
  color?: string;
  onColorChange: (broker: string, ticket: number, color: string) => void;
  onEdit: (p: Position) => void;
  onCancel: (p: Position) => void;
  onOpenChart?: (p: Position) => void;
}

const kindOf = (type: number): string => (type === 2 || type === 3 ? 'Limit' : 'Stop');

// The Positions card with the order's price and its distance to the market in
// the P&L slot; the order kind sits in the label row so the symbol line stays clean.
export function OrderCard({ order: p, color, onColorChange, onEdit, onCancel, onOpenChart }: OrderCardProps) {
  const { open, expanded, touchHandlers, onSummaryClick } = useSwipeActions(() => onOpenChart?.(p));
  const distance = orderDistancePips(p);
  const distanceClass = distance === null ? own.pending : distance >= 0 ? styles.profit : styles.loss;

  return (
    <div className={`${styles.card} ${expanded ? styles.cardExpanded : ''}`}>
      <div className={styles.swipeRow} {...touchHandlers}>
        <div className={styles.actions}>
          <div className={`${styles.actionsInner} ${open ? styles.actionsInnerOpen : ''} ${expanded ? styles.actionsInnerExpanded : ''}`}>
            <button type="button" className={styles.editBtn} onClick={() => onEdit(p)}>Edit</button>
            <button type="button" className={styles.closeBtn} onClick={() => onCancel(p)}>Cancel</button>
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
          <span className={styles.label}>Symbol <span className={own.kind}>· {kindOf(p.type)}</span></span>
          <span className={styles.label}>Price</span>
          <span className={`${styles.label} ${styles.right}`}>Distance</span>

          <span className={styles.symbolCell}>
            <ColorBadge broker={p.broker!} ticket={p.ticket} color={color} onColorChange={onColorChange} />
            <span className={isBuySide(p.type) ? styles.buy : styles.sell}>{p.symbol}</span>
          </span>
          <span className={styles.value}>{fmt(p.openPrice, 5)}</span>
          <span className={`${distanceClass} ${styles.right} ${own.distance}`}>{fmtDistance(distance)}</span>
        </div>
      </div>

      {expanded && (
        <div className={styles.details}>
          <div className={styles.field}>
            <span className={styles.label}>Type</span>
            <span className={isBuySide(p.type) ? styles.buy : styles.sell}>{TYPE_LABEL[p.type]}</span>
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
            <span className={styles.label}>Broker</span>
            <span className={styles.brokerName}>{p.broker}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Placed</span>
            <span className={styles.date}>{fmtLocalTime(p.openTime, p.brokerOffset)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
