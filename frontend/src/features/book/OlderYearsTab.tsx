import { useEffect, useRef, useState } from 'react';
import styles from './BookPage.module.css';

interface OlderYearsTabProps {
  years: number[];
  active: number | null;
  onSelect: (year: number) => void;
}

// The "Anteriores" tab: the years past the three newest, in the app's own menu
// (dark thin scrollbar) instead of the native select.
export function OlderYearsTab({ years, active, onSelect }: OlderYearsTabProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
    <div className={styles.olderWrap} ref={ref}>
      <button
        type="button"
        role="tab"
        aria-selected={active !== null}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${styles.tab} ${active !== null ? styles.tabActive : ''} ${open ? styles.tabOpen : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        {active ?? 'Anteriores'} ▾
      </button>
      {open && (
        <div className={styles.olderMenu} role="menu">
          {years.map(y => (
            <button
              key={y}
              type="button"
              role="menuitem"
              className={`${styles.olderItem} ${y === active ? styles.olderItemActive : ''}`}
              onClick={() => { onSelect(y); setOpen(false); }}
            >
              {y}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
