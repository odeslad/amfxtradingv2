import type { PriceAlert } from '../../lib/useAlerts';
import styles from './AlertActionBar.module.css';

interface AlertActionBarProps {
  alert: PriceAlert;
  onEditPrice: (alert: PriceAlert) => void;
  onToggle: (alert: PriceAlert) => void;
  onDelete: (alert: PriceAlert) => void;
}

// Phone only (spec 028): the actions of the alert selected on the chart.
export function AlertActionBar({ alert, onEditPrice, onToggle, onDelete }: AlertActionBarProps) {
  return (
    <div className={styles.bar} role="toolbar" aria-label={`${alert.symbol} alert ${alert.price}`}>
      <button type="button" className={styles.editBtn} onClick={() => onEditPrice(alert)}>Edit price</button>
      <button type="button" className={styles.toggleBtn} onClick={() => onToggle(alert)}>{alert.enabled ? 'Off' : 'On'}</button>
      <button type="button" className={styles.deleteBtn} onClick={() => onDelete(alert)}>Delete</button>
    </div>
  );
}
