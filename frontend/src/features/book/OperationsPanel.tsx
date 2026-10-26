import type { BookScheme, BookTrade } from '../../lib/book';
import { OperationCard } from './OperationCard';
import styles from '../journal/BulkEditPanel.module.css';
import own from './OperationsPanel.module.css';

interface OperationsPanelProps {
  scheme: BookScheme | null;
  onNewTrade: (scheme: BookScheme) => void;
  onEditTrade: (scheme: BookScheme, trade: BookTrade) => void;
  onDeleteTrade: (scheme: BookScheme, trade: BookTrade) => void;
  onClose: () => void;
}

// Full-screen list of a scheme's operations on the phone (spec 026). The scheme comes
// from the page's current data, so an edit or delete refreshes it in place.
export function OperationsPanel({ scheme, onNewTrade, onEditTrade, onDeleteTrade, onClose }: OperationsPanelProps) {
  const open = scheme !== null;

  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}
      <div className={`${styles.panel} ${own.panel} ${open ? styles.panelOpen : ''}`}>
        <div className={styles.header}>
          <div className={styles.title}>Operaciones · esquema {scheme?.number ?? ''}</div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className={own.list}>
          {scheme && scheme.trades.length === 0 && <span className={own.empty}>Sin operaciones todavía.</span>}
          {scheme?.trades.map(t => (
            <OperationCard
              key={t.id}
              trade={t}
              onEdit={trade => onEditTrade(scheme, trade)}
              onDelete={trade => onDeleteTrade(scheme, trade)}
            />
          ))}
          {scheme && scheme.trades.length > 0 && <div className={own.listEnd} />}
        </div>

        <div className={own.footer}>
          <button type="button" className={styles.submitBtn} onClick={() => scheme && onNewTrade(scheme)}>+ Nueva operación</button>
        </div>
      </div>
    </>
  );
}
