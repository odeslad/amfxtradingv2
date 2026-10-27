// The one date format of the app's inputs (spec 027): DD/MM/YYYY or DD/MM/YYYY HH:MM,
// typed as digits only. Pure helpers, no timezone: each form converts at its own edge.

export type DateMode = 'date' | 'datetime';

export interface DateParts {
  year: number;
  month: number;   // 0-11
  day: number;
  hour: number;
  minute: number;
}

const DIGITS: Record<DateMode, number> = { date: 8, datetime: 12 };
const LENGTH: Record<DateMode, number> = { date: 10, datetime: 16 };

const pad = (n: number): string => String(n).padStart(2, '0');

const layout = (digits: string, mode: DateMode): string => {
  let out = digits.slice(0, 2);
  if (digits.length > 2) out += '/' + digits.slice(2, 4);
  if (digits.length > 4) out += '/' + digits.slice(4, 8);
  if (mode === 'datetime' && digits.length > 8) out += ' ' + digits.slice(8, 10);
  if (mode === 'datetime' && digits.length > 10) out += ':' + digits.slice(10, 12);
  return out;
};

// Keeps the digits of `raw` and lays them out with separators. When `raw` is shorter than
// `prev` but holds the same digits, a separator was deleted: the digit before it goes too,
// so backspace never gets stuck behind a "/" or ":".
export function formatDigits(raw: string, mode: DateMode, prev = ''): string {
  let digits = raw.replace(/\D/g, '');
  if (raw.length < prev.length && digits === prev.replace(/\D/g, '')) digits = digits.slice(0, -1);
  return layout(digits.slice(0, DIGITS[mode]), mode);
}

// HH:MM typed as digits, for the calendar's time field.
export function formatTimeDigits(raw: string, prev = ''): string {
  let digits = raw.replace(/\D/g, '');
  if (raw.length < prev.length && digits === prev.replace(/\D/g, '')) digits = digits.slice(0, -1);
  digits = digits.slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

export const isComplete = (text: string, mode: DateMode): boolean => text.length === LENGTH[mode];

export function parseDisplay(text: string, mode: DateMode): DateParts | null {
  const m = mode === 'datetime'
    ? /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(text)
    : /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]) - 1;
  const year = Number(m[3]);
  const hour = mode === 'datetime' ? Number(m[4]) : 0;
  const minute = mode === 'datetime' ? Number(m[5]) : 0;
  const d = new Date(Date.UTC(year, month, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month || d.getUTCDate() !== day) return null;
  if (hour > 23 || minute > 59) return null;
  return { year, month, day, hour, minute };
}

export const toDisplay = (p: DateParts, mode: DateMode): string =>
  `${pad(p.day)}/${pad(p.month + 1)}/${p.year}${mode === 'datetime' ? ` ${pad(p.hour)}:${pad(p.minute)}` : ''}`;

// "2026-10-14" ↔ "14/10/2026": the filters' and the scheme's date values.
export function isoDateToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

export function displayToIsoDate(text: string): string | null {
  const p = parseDisplay(text, 'date');
  return p ? `${p.year}-${pad(p.month + 1)}-${pad(p.day)}` : null;
}
