import { type DateRange, DATE_RANGE_OPTIONS } from '../journal/utils/dateRange';
import { IsoDateField } from '../../shared/ui/DateField';
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
            <label className={styles.label} htmlFor="stats-date-from">From</label>
            <IsoDateField id="stats-date-from" className={`${styles.input} ${styles.dateInput}`} value={values.dateFrom} onChange={iso => onChange({ ...values, dateFrom: iso })} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="stats-date-to">To</label>
            <IsoDateField id="stats-date-to" className={`${styles.input} ${styles.dateInput}`} value={values.dateTo} onChange={iso => onChange({ ...values, dateTo: iso })} />
          </div>
        </>
      )}
    </div>
  );
}
