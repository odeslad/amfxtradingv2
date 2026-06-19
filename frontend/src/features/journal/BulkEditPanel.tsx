import { useState, useEffect } from 'react';
import { type Position, TYPE_LABEL, fmt } from './utils/position';
import { apiUrl } from '../../lib/api';
import { addToast } from '../../lib/toast';
import styles from './BulkEditPanel.module.css';

interface BulkEditPanelProps {
  open: boolean;
  positions: Position[];
  onClose: () => void;
}

function generateId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

export function BulkEditPanel({ open, positions, onClose }: BulkEditPanelProps) {
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) { setSl(''); setTp(''); setSubmitting(false); }
  }, [open]);

  const first = positions[0];
  const label = first ? `${TYPE_LABEL[first.type]} ${first.symbol}` : '';

  const handleSubmit = async () => {
    if (!sl && !tp) return;
    setSubmitting(true);
    try {
      await Promise.all(positions.map(p =>
        fetch(apiUrl('/commands'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: generateId(),
            action: 'modify',
            broker: p.broker,
            symbol: p.symbol,
            ticket: p.ticket,
            lots: p.lots,
            sl: sl ? parseFloat(sl) : p.sl,
            tp: tp ? parseFloat(tp) : p.tp,
          }),
        })
      ));
      addToast(`Modify sent for ${positions.length} position${positions.length > 1 ? 's' : ''}`, 'info');
      onClose();
    } catch {
      addToast('Failed to send modify commands', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}
      <div className={`${styles.panel} ${open ? styles.panelOpen : ''}`}>
        <div className={styles.header}>
          <div className={styles.title}>Edit group</div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.form}>
          <div className={styles.meta}>{label} · {positions.length} position{positions.length !== 1 ? 's' : ''}</div>
          <p className={styles.hint}>Leave a field empty to keep each position's current value.</p>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>SL</label>
              <input
                type="number"
                className={styles.input}
                value={sl}
                onChange={e => setSl(e.target.value)}
                placeholder={first ? fmt(first.sl, 5) : '0'}
                step="0.00001"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>TP</label>
              <input
                type="number"
                className={styles.input}
                value={tp}
                onChange={e => setTp(e.target.value)}
                placeholder={first ? fmt(first.tp, 5) : '0.00000'}
                step="0.00001"
              />
            </div>
          </div>

          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={submitting || (!sl && !tp)}
          >
            {submitting ? 'Sending...' : `Modify ${positions.length}`}
          </button>
        </div>
      </div>
    </>
  );
}
