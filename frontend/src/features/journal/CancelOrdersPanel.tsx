import { type Position } from './utils/position';
import { OrderList } from './OrderList';
import styles from './ConfirmPanel.module.css';

interface CancelOrdersPanelProps {
  open: boolean;
  orders: Position[];
  cancelling: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function CancelOrdersPanel({ open, orders, cancelling, onConfirm, onClose }: CancelOrdersPanelProps) {
  const many = orders.length > 1;
  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}
      <div className={`${styles.panel} ${open ? styles.panelOpen : ''}`}>
        <div className={styles.header}>
          <div className={styles.title}>{many ? `Cancel ${orders.length} orders?` : 'Cancel order?'}</div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          <OrderList orders={orders} />
          <div className={styles.actions}>
            <button type="button" className={styles.confirmBtn} onClick={onConfirm} disabled={cancelling}>
              {cancelling ? 'Cancelling...' : many ? 'Cancel all' : 'Cancel order'}
            </button>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>{many ? 'Keep orders' : 'Keep order'}</button>
          </div>
        </div>
      </div>
    </>
  );
}
