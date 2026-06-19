import { useRef, useState, type TouchEvent } from 'react';
import { POSITION_COLORS, POSITION_COLOR_VALUES, type PositionColor } from './utils/position';
import type { BulkGroup } from './OpenPositions';
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
  bulk?: BulkGroup | null;
  onBulkEdit?: () => void;
  onBulkClose?: () => void;
}

const SWIPE_THRESHOLD = 50;
const TAP_TOLERANCE = 8;

export function Filters({ values, options, onChange, bulk, onBulkEdit, onBulkClose }: FiltersProps) {
  const set = (key: keyof FilterValues) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    onChange({ ...values, [key]: e.target.value });

  const [swipeOpen, setSwipeOpen] = useState(false);
  const startX = useRef(0);
  const lastDx = useRef(0);
  const moved = useRef(false);

  const onTouchStart = (e: TouchEvent) => {
    startX.current = e.touches[0].clientX;
    lastDx.current = 0;
    moved.current = false;
  };

  const onTouchMove = (e: TouchEvent) => {
    lastDx.current = e.touches[0].clientX - startX.current;
    if (Math.abs(lastDx.current) > TAP_TOLERANCE) moved.current = true;
  };

  const onTouchEnd = () => {
    if (lastDx.current < -SWIPE_THRESHOLD) setSwipeOpen(true);
    else if (lastDx.current > SWIPE_THRESHOLD) setSwipeOpen(false);
  };

  const hasBulk = !!bulk;

  return (
    <div className={styles.wrapper}>
      {/* Mobile first row: swipeable when bulk group active */}
      <div
        className={`${styles.firstRow} ${hasBulk && swipeOpen ? styles.firstRowSlid : ''}`}
        onTouchStart={hasBulk ? onTouchStart : undefined}
        onTouchMove={hasBulk ? onTouchMove : undefined}
        onTouchEnd={hasBulk ? onTouchEnd : undefined}
      >
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
        </div>

        {hasBulk && (
          <div className={styles.bulkActions}>
            <button type="button" className={styles.bulkEdit} onClick={() => { setSwipeOpen(false); onBulkEdit?.(); }}>
              Edit
            </button>
            <button type="button" className={styles.bulkClose} onClick={() => { setSwipeOpen(false); onBulkClose?.(); }}>
              Close
            </button>
          </div>
        )}
      </div>

      {/* Color filter — always second row when visible */}
      {options.colors.length > 0 && (
        <div className={styles.colorRow}>
          <select className={`${styles.select} ${styles.colorSelect}`} value={values.color} onChange={set('color')}>
            <option value="">All Colors</option>
            {POSITION_COLORS.filter(c => options.colors.includes(c)).map(c => (
              <option key={c} value={c} style={{ color: POSITION_COLOR_VALUES[c as PositionColor] }}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
