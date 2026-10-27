import { useState } from 'react';
import { formatTimeDigits, parseDisplay, toDisplay, type DateMode } from '../../lib/dateField';
import styles from './Calendar.module.css';

interface CalendarProps {
  mode: DateMode;
  value: string;                          // the field's display text
  sheet: boolean;                         // phone bottom sheet: bigger days and an Aceptar button
  onChange: (text: string) => void;
  onClose: () => void;
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const monthKey = (year: number, month: number): number => year * 12 + month;

// The app's own month calendar (spec 027): Monday first, selected day orange, today
// outlined blue, Hoy, and a time field in datetime mode.
export function Calendar({ mode, value, sheet, onChange, onClose }: CalendarProps) {
  const selected = parseDisplay(value, mode);
  const now = new Date();
  const [view, setView] = useState(() => monthKey(selected?.year ?? now.getFullYear(), selected?.month ?? now.getMonth()));

  // A date typed in the field moves the calendar to its month (adjusted during render).
  const selectedKey = selected ? monthKey(selected.year, selected.month) : null;
  const [followed, setFollowed] = useState(selectedKey);
  if (selectedKey !== null && selectedKey !== followed) {
    setFollowed(selectedKey);
    setView(selectedKey);
  }

  const year = Math.floor(view / 12);
  const month = view % 12;
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const timeText = mode === 'datetime' && value.length > 11 ? value.slice(11) : '';

  const pick = (day: number, close: boolean) => {
    const hasTime = mode === 'datetime' && value.length === 16;
    const parts = {
      year, month, day,
      hour: hasTime ? Number(value.slice(11, 13)) : 0,
      minute: hasTime ? Number(value.slice(14, 16)) : 0,
    };
    onChange(toDisplay(parts, mode));
    if (close) onClose();
  };

  const pickDay = (day: number) => pick(day, mode === 'date');

  const pickToday = () => {
    setView(monthKey(now.getFullYear(), now.getMonth()));
    const parts = { year: now.getFullYear(), month: now.getMonth(), day: now.getDate(), hour: 0, minute: 0 };
    if (mode === 'datetime' && value.length === 16) { parts.hour = Number(value.slice(11, 13)); parts.minute = Number(value.slice(14, 16)); }
    onChange(toDisplay(parts, mode));
    if (mode === 'date') onClose();
  };

  const onTime = (raw: string) => {
    const date = value.slice(0, 10);
    if (date.length !== 10) return;
    const time = formatTimeDigits(raw, timeText);
    onChange(time ? `${date} ${time}` : date);
  };

  const cells: (number | null)[] = [...Array<null>(offset).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];

  return (
    <div className={`${styles.calendar} ${sheet ? styles.sheet : ''}`} role="dialog" aria-label="Calendario">
      <div className={styles.head}>
        <button type="button" className={styles.nav} onClick={() => setView(v => v - 1)} aria-label="Mes anterior">‹</button>
        <span className={styles.month}>{MONTHS[month]} {year}</span>
        <button type="button" className={styles.nav} onClick={() => setView(v => v + 1)} aria-label="Mes siguiente">›</button>
      </div>

      <div className={styles.grid}>
        {WEEKDAYS.map(w => <span key={w} className={styles.dow}>{w}</span>)}
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} />;
          const isSelected = selected !== null && selected.year === year && selected.month === month && selected.day === day;
          const isToday = now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
          return (
            <button
              key={day}
              type="button"
              className={`${styles.day} ${isSelected ? styles.selected : isToday ? styles.today : ''}`}
              onClick={() => pickDay(day)}
              aria-pressed={isSelected}
            >
              {day}
            </button>
          );
        })}
      </div>

      {mode === 'datetime' && (
        <label className={styles.timeRow}>
          <span className={styles.label}>Hora</span>
          <input
            className={styles.time}
            type="text"
            inputMode="numeric"
            placeholder="HH:MM"
            value={timeText}
            disabled={value.length < 10}
            onChange={e => onTime(e.target.value)}
          />
        </label>
      )}

      <div className={styles.foot}>
        <button type="button" className={styles.link} onClick={pickToday}>Hoy</button>
        {sheet
          ? <button type="button" className={styles.accept} onClick={onClose}>Aceptar</button>
          : <button type="button" className={`${styles.link} ${styles.muted}`} onClick={onClose}>Cerrar</button>}
      </div>
    </div>
  );
}
