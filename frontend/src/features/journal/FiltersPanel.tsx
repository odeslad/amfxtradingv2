import { POSITION_COLORS, POSITION_COLOR_VALUES, type PositionColor } from './utils/position';
import styles from './FiltersPanel.module.css';

export interface FilterValues {
  broker: string;
  symbol: string;
  type: string;
  color: string;
}

export interface FilterOptions {
  brokers: string[];
  symbols: string[];
  colors: string[];
}

interface FiltersPanelProps {
  open: boolean;
  onClose: () => void;
  values: FilterValues;
  options: FilterOptions;
  onChange: (values: FilterValues) => void;
}

export function FiltersPanel({ open, onClose, values, options, onChange }: FiltersPanelProps) {
  const set = (key: keyof FilterValues) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    onChange({ ...values, [key]: e.target.value });

  const hasActiveFilters = !!(values.broker || values.symbol || values.type || values.color);

  const reset = () => onChange({ broker: '', symbol: '', type: '', color: '' });

  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}
      <div className={`${styles.panel} ${open ? styles.panelOpen : ''}`}>
        <div className={styles.header}>
          <span className={styles.title}>Filters</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Broker</label>
            <select className={styles.input} value={values.broker} onChange={set('broker')}>
              <option value="">All Brokers</option>
              {options.brokers.map(b => <option key={b} value={b}>{b.toUpperCase()}</option>)}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Symbol</label>
            <select className={styles.input} value={values.symbol} onChange={set('symbol')}>
              <option value="">All Symbols</option>
              {options.symbols.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Type</label>
            <select className={styles.input} value={values.type} onChange={set('type')}>
              <option value="">All Types</option>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>

          {options.colors.length > 0 && (
            <div className={styles.field}>
              <label className={styles.label}>Color</label>
              <select className={styles.input} value={values.color} onChange={set('color')}>
                <option value="">All Colors</option>
                {POSITION_COLORS.filter(c => options.colors.includes(c)).map(c => (
                  <option key={c} value={c} style={{ color: POSITION_COLOR_VALUES[c as PositionColor] }}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {hasActiveFilters && (
            <button type="button" className={styles.resetBtn} onClick={reset}>
              Reset filters
            </button>
          )}
        </div>
      </div>
    </>
  );
}
