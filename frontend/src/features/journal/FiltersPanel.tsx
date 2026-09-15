import { POSITION_COLORS, POSITION_COLOR_VALUES, type PositionColor } from './utils/position';
import { type DateRange, DATE_RANGE_OPTIONS } from './utils/dateRange';
import styles from './FiltersPanel.module.css';

export interface FilterValues {
  broker: string;
  symbol: string;
  type: string;
  color: string;
  dateRange: DateRange;
  dateFrom: string;
  dateTo: string;
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
  showDateFilter?: boolean;
}

export function FiltersPanel({ open, onClose, values, options, onChange, showDateFilter }: FiltersPanelProps) {
  const set = (key: keyof FilterValues) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
    onChange({ ...values, [key]: e.target.value });

  const hasActiveFilters = !!(values.broker || values.symbol || values.type || values.color || values.dateRange);

  const reset = () =>
    onChange({ broker: '', symbol: '', type: '', color: '', dateRange: '', dateFrom: '', dateTo: '' });

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

          {showDateFilter && (
            <>
              <div className={styles.field}>
                <label className={styles.label}>Date</label>
                <select className={styles.input} value={values.dateRange} onChange={set('dateRange')}>
                  {DATE_RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {values.dateRange === 'custom' && (
                <div className={styles.row}>
                  <div className={styles.field}>
                    <label className={styles.label}>From</label>
                    <input
                      className={`${styles.input} ${styles.dateInput}`}
                      type="date"
                      value={values.dateFrom}
                      max={values.dateTo || undefined}
                      onChange={set('dateFrom')}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>To</label>
                    <input
                      className={`${styles.input} ${styles.dateInput}`}
                      type="date"
                      value={values.dateTo}
                      min={values.dateFrom || undefined}
                      onChange={set('dateTo')}
                    />
                  </div>
                </div>
              )}
            </>
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
