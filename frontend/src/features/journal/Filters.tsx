import { POSITION_COLORS, POSITION_COLOR_VALUES, type PositionColor } from './utils/position';
import styles from './Filters.module.css';

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

interface FiltersProps {
  values: FilterValues;
  options: FilterOptions;
  onChange: (values: FilterValues) => void;
}

export function Filters({ values, options, onChange }: FiltersProps) {
  const set = (key: keyof FilterValues) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    onChange({ ...values, [key]: e.target.value });

  return (
    <div className={styles.filters}>
      <select className={styles.select} value={values.broker} onChange={set('broker')}>
        <option value="">All Brokers</option>
        {options.brokers.map(b => <option key={b} value={b}>{b.toUpperCase()}</option>)}
      </select>
      <select className={styles.select} value={values.symbol} onChange={set('symbol')}>
        <option value="">All Symbols</option>
        {options.symbols.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <select className={styles.select} value={values.type} onChange={set('type')}>
        <option value="">All Types</option>
        <option value="buy">Buy</option>
        <option value="sell">Sell</option>
      </select>
      {options.colors.length > 0 && (
        <select className={styles.select} value={values.color} onChange={set('color')}>
          <option value="">All Colors</option>
          {POSITION_COLORS.filter(c => options.colors.includes(c)).map(c => (
            <option key={c} value={c} style={{ color: POSITION_COLOR_VALUES[c as PositionColor] }}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
