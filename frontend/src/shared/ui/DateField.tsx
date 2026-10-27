import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { displayToIsoDate, formatDigits, isComplete, isoDateToDisplay, parseDisplay, type DateMode } from '../../lib/dateField';
import { Calendar } from './Calendar';
import styles from './DateField.module.css';

interface DateFieldProps {
  mode: DateMode;
  value: string;                       // display text: DD/MM/YYYY or DD/MM/YYYY HH:MM
  onChange: (text: string) => void;
  id?: string;
  required?: boolean;
  invalid?: boolean;
  className?: string;                  // the consumer's input style (height, font)
  'aria-label'?: string;
}

const EDGE = 8;
const GAP = 4;
const PHONE = '(max-width: 768px)';

// The app's one date input (spec 027): digits only, separators inserted as you type,
// and its own calendar (popover on desktop, bottom sheet on the phone).
export function DateField({ mode, value, onChange, id, required, invalid, className, 'aria-label': ariaLabel }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const bad = invalid || (isComplete(value, mode) && parseDisplay(value, mode) === null);
  const placeholder = mode === 'datetime' ? 'DD/MM/YYYY HH:MM' : 'DD/MM/YYYY';

  const toggle = () => {
    if (!open) setSheet(window.matchMedia(PHONE).matches);
    setOpen(o => !o);
  };
  const close = () => setOpen(false);

  // Desktop popover: under the field, aligned left; right-aligned when it would cross the
  // right edge, above when it would cross the bottom, and never closer than 8 px to an edge.
  useLayoutEffect(() => {
    if (!open || sheet) return;
    const place = () => {
      const field = wrapRef.current?.getBoundingClientRect();
      const pop = popRef.current;
      if (!field || !pop) return;
      const { width, height } = pop.getBoundingClientRect();
      let left = field.left;
      if (left + width > window.innerWidth - EDGE) left = field.right - width;
      left = Math.max(EDGE, Math.min(left, window.innerWidth - EDGE - width));
      let top = field.bottom + GAP;
      if (top + height > window.innerHeight - EDGE) top = field.top - GAP - height;
      top = Math.max(EDGE, top);
      pop.style.left = `${left}px`;
      pop.style.top = `${top}px`;
      pop.style.visibility = 'visible';
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, sheet]);

  // Outside pointer or Escape closes the calendar.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <input
        id={id}
        className={`${className ?? ''} ${styles.input} ${bad ? styles.invalid : ''}`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        required={required}
        aria-label={ariaLabel}
        aria-invalid={bad || undefined}
        onChange={e => onChange(formatDigits(e.target.value, mode, value))}
      />
      <button
        type="button"
        className={`${styles.icon} ${open ? styles.iconOpen : ''}`}
        onClick={toggle}
        aria-label="Abrir calendario"
        aria-expanded={open}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="2" y="3" width="12" height="11" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </button>

      {open && createPortal(
        sheet ? (
          <>
            <div className={styles.backdrop} onClick={close} />
            <div className={styles.sheet} ref={popRef}>
              <Calendar mode={mode} value={value} sheet onChange={onChange} onClose={close} />
            </div>
          </>
        ) : (
          <div className={styles.popover} ref={popRef}>
            <Calendar mode={mode} value={value} sheet={false} onChange={onChange} onClose={close} />
          </div>
        ),
        document.body,
      )}
    </div>
  );
}

interface IsoDateFieldProps extends Omit<DateFieldProps, 'mode' | 'value' | 'onChange'> {
  value: string;                       // YYYY-MM-DD or ''
  onChange: (iso: string) => void;     // a valid date, or '' when cleared
}

// For values kept as YYYY-MM-DD (filters, scheme dates): the partial text lives here and
// only a complete valid date (or an empty field) reaches the form.
export function IsoDateField({ value, onChange, ...rest }: IsoDateFieldProps) {
  const [text, setText] = useState(() => isoDateToDisplay(value));
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    if (displayToIsoDate(text) !== value) setText(isoDateToDisplay(value));
  }

  const change = (next: string) => {
    setText(next);
    if (next === '') { setSynced(''); onChange(''); return; }
    const iso = displayToIsoDate(next);
    if (iso) { setSynced(iso); onChange(iso); }
  };

  return <DateField {...rest} mode="date" value={text} onChange={change} />;
}
