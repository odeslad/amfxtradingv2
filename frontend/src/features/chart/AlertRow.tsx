import type { ReactNode } from 'react';
import { useSwipeActions } from '../journal/utils/useSwipeActions';
import styles from './AlertsPanel.module.css';

interface AlertRowProps {
  off: boolean;
  label: string;
  onActivate?: () => void;
  actions: ReactNode;
  children: ReactNode;
}

// An alert in the list: its buttons slide in from the right like Positions
// (hover on desktop, swipe left on touch), the rest of the row opens the edit.
export function AlertRow({ off, label, onActivate, actions, children }: AlertRowProps) {
  const { open, touchHandlers } = useSwipeActions();

  return (
    <div className={`${styles.item} ${off ? styles.itemOff : ''}`} {...touchHandlers}>
      {onActivate ? (
        <button type="button" className={styles.itemEdit} aria-label={label} onClick={onActivate}>{children}</button>
      ) : (
        <div className={styles.itemEdit}>{children}</div>
      )}
      <div className={styles.itemActions}>
        <div className={`${styles.itemActionsInner} ${open ? styles.itemActionsOpen : ''}`}>{actions}</div>
      </div>
    </div>
  );
}
