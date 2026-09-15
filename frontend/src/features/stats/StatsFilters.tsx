import { type DateRange, DATE_RANGE_OPTIONS } from '../journal/utils/dateRange';
import styles from './StatsFilters.module.css';

export interface StatsFilterValues {
  broker: string;
  dateRange: DateRange;
  dateFrom: string;
  dateTo: string;
}

interface StatsFiltersProps {
  brokers: string[];
  values: StatsFilterValues;
  onChange: (values: StatsFilterValues) => void;
}

export function StatsFilters({ brokers, values, onChange }: StatsFiltersProps) {
  const set = (key: keyof StatsFilterValues) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
    onChange({ ...values, [key]: e.target.value });

  return (
    <div className={styles.filters}>
      <div className={styles.field}>
        <label className={styles.label}>Broker</label>
        <select className={styles.input} value={values.broker} onChange={set('broker')}>
          {brokers.map(b => <option key={b} value={b}>{b.toUpperCase()}</option>)}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Period</label>
        <select className={styles.input} value={values.dateRange} onChange={set('dateRange')}>
          {DATE_RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {values.dateRange === 'custom' && (
        <>
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
        </>
      )}
    </div>
  );
}
