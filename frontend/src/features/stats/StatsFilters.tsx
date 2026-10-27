import { type DateRange, clampToToday } from '../journal/utils/dateRange';
import { IsoDateField } from '../../shared/ui/DateField';
import { PeriodTabs } from './PeriodTabs';
import styles from './StatsFilters.module.css';

export interface StatsFilterValues {
  broker: string;
  symbol: string;
  dateRange: DateRange;
  dateFrom: string;
  dateTo: string;
}

interface StatsFiltersProps {
  brokers: string[];
  symbols: string[];
  values: StatsFilterValues;
  onChange: (values: StatsFilterValues) => void;
}

export function StatsFilters({ brokers, symbols, values, onChange }: StatsFiltersProps) {
  return (
    <div className={styles.filters}>
      <div className={styles.bar}>
        <PeriodTabs value={values.dateRange} onChange={dateRange => onChange({ ...values, dateRange })} />
        <div className={styles.selects}>
          <label className={styles.field}>
            <span className={styles.label}>Broker</span>
            <select className={styles.input} value={values.broker} onChange={e => onChange({ ...values, broker: e.target.value })}>
              {brokers.map(b => <option key={b} value={b}>{b.toUpperCase()}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Activo</span>
            <select
              className={`${styles.input} ${values.symbol ? styles.inputActive : ''}`}
              value={values.symbol}
              onChange={e => onChange({ ...values, symbol: e.target.value })}
            >
              <option value="">Todos</option>
              {symbols.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
      </div>

      {values.dateRange === 'custom' && (
        <div className={styles.custom}>
          <label className={styles.field} htmlFor="stats-date-from">
            <span className={styles.label}>Desde</span>
            <IsoDateField id="stats-date-from" className={`${styles.input} ${styles.dateInput}`} value={values.dateFrom} onChange={iso => onChange({ ...values, dateFrom: iso })} />
          </label>
          <label className={styles.field} htmlFor="stats-date-to">
            <span className={styles.label}>Hasta</span>
            <IsoDateField id="stats-date-to" className={`${styles.input} ${styles.dateInput}`} value={values.dateTo} onChange={iso => onChange({ ...values, dateTo: clampToToday(iso) })} />
          </label>
        </div>
      )}
    </div>
  );
}
