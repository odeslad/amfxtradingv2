import { useState, type KeyboardEvent } from 'react';
import { errorMessage } from '../../lib/api';
import { addToast } from '../../lib/toast';
import type { PriceAlert } from '../../lib/useAlerts';
import styles from './AlertsPanel.module.css';

interface AlertPriceEditProps {
  alert: PriceAlert;
  onSave: (id: number, price: number) => Promise<void>;
  onDone: () => void;
}

// The alert row opened for a new price (spec 028): Enter saves, Esc cancels.
export function AlertPriceEdit({ alert, onSave, onDone }: AlertPriceEditProps) {
  const [value, setValue] = useState(String(alert.price));
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const price = Number(value.replace(',', '.'));
    if (!Number.isFinite(price) || price <= 0) { setInvalid(true); return; }
    setSaving(true);
    try {
      await onSave(alert.id, price);
      onDone();
    } catch (err) {
      addToast(errorMessage(err, 'Failed to update alert'), 'error');
      setSaving(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); void save(); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onDone(); }
  };

  return (
    <div className={`${styles.item} ${styles.itemEditing}`}>
      <div className={styles.editHead}>
        <div className={styles.itemMain}>
          <span className={styles.itemSymbol}>{alert.symbol}</span>
          <span className={styles.itemBroker}>{alert.broker}</span>
        </div>
        <span className={styles.editDirection}>
          {alert.direction === 'above' ? '▲ Crosses above' : '▼ Crosses below'}
        </span>
      </div>
      <div className={styles.editRow}>
        <input
          className={`${styles.input} ${styles.editInput} ${invalid ? styles.inputError : ''}`}
          type="text"
          inputMode="decimal"
          aria-label="New price"
          autoFocus
          value={value}
          onChange={e => { setValue(e.target.value); setInvalid(false); }}
          onKeyDown={onKeyDown}
        />
        <button type="button" className={styles.saveBtn} onClick={() => void save()} disabled={saving}>Save</button>
        <button type="button" className={styles.cancelBtn} onClick={onDone} disabled={saving}>Cancel</button>
      </div>
    </div>
  );
}
