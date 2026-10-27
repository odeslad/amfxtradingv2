import { useEffect, useRef, useState } from 'react';
import { type DateRange, DATE_RANGE_OPTIONS } from '../journal/utils/dateRange';
import styles from './PeriodTabs.module.css';

interface PeriodTabsProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
}

interface Tab {
  value: DateRange;
  short: string;
}

const TABS: Tab[] = [
  { value: 'today', short: 'Hoy' },
  { value: 'yesterday', short: 'Ayer' },
  { value: 'last_7_days', short: 'Semana' },
  { value: 'last_30_days', short: 'Mes' },
];

const labelOf = (value: DateRange): string => DATE_RANGE_OPTIONS.find(o => o.value === value)?.label ?? '';
const MORE = DATE_RANGE_OPTIONS.filter(o => !TABS.some(t => t.value === o.value));

// Period tabs + "Más" menu like the Schemes year tabs (spec 029). The "Más" tab keeps
// its label and turns active when one of its options is selected.
export function PeriodTabs({ value, onChange }: PeriodTabsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const moreActive = MORE.some(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={styles.tabs} role="tablist" aria-label="Periodo">
      {TABS.map(t => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          className={`${styles.tab} ${value === t.value ? styles.tabActive : ''}`}
          onClick={() => onChange(t.value)}
        >
          <span className={styles.labelLong}>{labelOf(t.value)}</span>
          <span className={styles.labelShort}>{t.short}</span>
        </button>
      ))}
      <div className={styles.moreWrap} ref={ref}>
        <button
          type="button"
          role="tab"
          aria-selected={moreActive}
          aria-haspopup="menu"
          aria-expanded={open}
          className={`${styles.tab} ${moreActive ? styles.tabActive : ''} ${open ? styles.tabOpen : ''}`}
          onClick={() => setOpen(o => !o)}
        >
          Más ▾
        </button>
        {open && (
          <div className={styles.menu} role="menu">
            {MORE.map(o => (
              <button
                key={o.value}
                type="button"
                role="menuitem"
                className={`${styles.menuItem} ${o.value === value ? styles.menuItemActive : ''}`}
                onClick={() => { onChange(o.value); setOpen(false); }}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
