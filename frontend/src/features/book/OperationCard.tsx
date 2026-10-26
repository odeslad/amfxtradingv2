import { fmtEur, fmtLots, fmtPips, fmtPrice, fmtR1, fmtShort, type BookTrade } from '../../lib/book';
import { useSwipeActions } from '../journal/utils/useSwipeActions';
import styles from './OperationCard.module.css';

interface OperationCardProps {
  trade: BookTrade;
  onEdit: (trade: BookTrade) => void;
  onDelete: (trade: BookTrade) => void;
}

const signClass = (v: number | null): string => (v === null ? styles.muted : v >= 0 ? styles.profit : styles.loss);

// A scheme operation in the Positions card format (spec 026): tap to expand,
// swipe left for Editar / Eliminar.
export function OperationCard({ trade: t, onEdit, onDelete }: OperationCardProps) {
  const { open, expanded, touchHandlers, onSummaryClick } = useSwipeActions();
  const running = t.closeTime === null;

  return (
    <div className={`${styles.card} ${expanded ? styles.cardExpanded : ''}`}>
      <div className={styles.swipeRow} {...touchHandlers}>
        <div className={styles.actions}>
          <div className={`${styles.actionsInner} ${open ? styles.actionsInnerOpen : ''}`}>
            <button type="button" className={styles.editBtn} onClick={() => onEdit(t)}>Editar</button>
            <button type="button" className={styles.deleteBtn} onClick={() => onDelete(t)}>Eliminar</button>
          </div>
        </div>

        <button
          type="button"
          className={`${styles.summary} ${expanded ? styles.summaryActive : ''}`}
          onClick={onSummaryClick}
          aria-expanded={expanded}
        >
          <span className={styles.label}>Posición</span>
          <span className={styles.label}>Entrada</span>
          <span className={`${styles.label} ${styles.right}`}>R</span>

          <span><span className={styles.slot}>{t.slot}</span> <span className={t.direction === 'buy' ? styles.profit : styles.loss}>{t.direction}</span></span>
          <span>{fmtPrice(t.entry)}</span>
          {running
            ? <span className={`${styles.right} ${styles.running}`}>en curso</span>
            : <span className={`${styles.right} ${styles.big} ${signClass(t.r)}`}>{fmtR1(t.r)}</span>}
        </button>
      </div>

      {expanded && (
        <div className={styles.details}>
          <div className={styles.field}><span className={styles.label}>Lotes</span><span>{fmtLots(t.lots)}</span></div>
          <div className={styles.field}><span className={styles.label}>Cierre</span><span>{fmtPrice(t.closePrice)}</span></div>
          <div className={styles.field}><span className={styles.label}>SL</span><span>{fmtPrice(t.sl)}</span></div>
          <div className={styles.field}><span className={styles.label}>Pips</span><span className={signClass(t.pips)}>{fmtPips(t.pips)}</span></div>
          <div className={styles.field}><span className={styles.label}>€</span><span className={signClass(t.profit)}>{fmtEur(t.profit)}</span></div>
          <div className={styles.field}><span className={styles.label}>Saldo</span><span>{fmtEur(t.balanceAfter)}</span></div>
          <div className={styles.field}><span className={styles.label}>Apertura</span><span>{fmtShort(t.openTime)}</span></div>
          <div className={styles.field}><span className={styles.label}>Cierre</span><span className={running ? styles.running : undefined}>{running ? 'en curso' : fmtShort(t.closeTime)}</span></div>
          <div className={styles.field}><span className={styles.label}>Ticket</span><span className={styles.muted}>{t.ticket}</span></div>
          {t.note && <div className={styles.note}><span className={styles.label}>Nota</span><span>{t.note}</span></div>}
        </div>
      )}
    </div>
  );
}
