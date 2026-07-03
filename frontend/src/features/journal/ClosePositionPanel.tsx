import { useState, useEffect } from 'react';
import { type Position, TYPE_LABEL, fmt } from './utils/position';
import { apiUrl } from '../../lib/api';
import { addToast } from '../../lib/toast';
import styles from './BulkEditPanel.module.css';

interface ClosePositionPanelProps {
  open: boolean;
  position: Position | null;
  onClose: () => void;
}

function generateId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

// Confirmation panel to close a single position from the chart. Reuses the
// BulkEditPanel styles so it matches the edit-group panel.
export function ClosePositionPanel({ open, position, onClose }: ClosePositionPanelProps) {
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (!open) setSubmitting(false); }, [open]);

  const label = position ? `${TYPE_LABEL[position.type]} ${position.symbol}` : '';

  const handleConfirm = async () => {
    if (!position) return;
    setSubmitting(true);
    try {
      await fetch(apiUrl('/commands'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: generateId(),
          action: 'close',
          broker: position.broker,
          symbol: position.symbol,
          ticket: position.ticket,
          lots: position.lots,
        }),
      });
      addToast(`Close sent for ${label}`, 'info');
      onClose();
    } catch {
      addToast('Failed to send close command', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}
      <div className={`${styles.panel} ${open ? styles.panelOpen : ''}`}>
        <div className={styles.header}>
          <div className={styles.title}>Close position</div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.form}>
          <div className={styles.meta}>{label}</div>
          {position && (
            <p className={styles.hint}>
              Ticket #{position.ticket} · {fmt(position.lots, 2)} lots @ {fmt(position.openPrice, 5)}
            </p>
          )}
          <p className={styles.hint}>This closes the position at market. It cannot be undone.</p>

          <button
            type="button"
            className={styles.dangerBtn}
            onClick={handleConfirm}
            disabled={submitting || !position}
          >
            {submitting ? 'Sending...' : 'Confirm close'}
          </button>
        </div>
      </div>
    </>
  );
}
