// Rolling windows ending now (spec 029), shared by the Journal and Stats.
export type DateRange =
  | ''
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'last_365_days'
  | 'custom';

export const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'today', label: 'Hoy' },
  { value: 'yesterday', label: 'Ayer' },
  { value: 'last_7_days', label: 'Esta semana' },
  { value: 'last_30_days', label: 'Este mes' },
  { value: 'last_90_days', label: 'Este trimestre' },
  { value: 'last_365_days', label: 'Este año' },
  { value: '', label: 'Todo' },
  { value: 'custom', label: 'Custom' },
];

const ROLLING_DAYS: Partial<Record<DateRange, number>> = {
  last_7_days: 7,
  last_30_days: 30,
  last_90_days: 90,
  last_365_days: 365,
};

// A period stored before spec 029 (last_week, this_month…) falls back to Todo.
export const normalizeDateRange = (value: string): DateRange =>
  DATE_RANGE_OPTIONS.some(o => o.value === value) ? (value as DateRange) : '';

const todayIso = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// The Custom "to" date never goes past today.
export const clampToToday = (iso: string): string => (iso && iso > todayIso() ? todayIso() : iso);

export interface DateRangeValues {
  dateRange: DateRange;
  dateFrom: string;
  dateTo: string;
}

interface Bounds {
  from?: string;
  to?: string;
}

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export function dateRangeBounds({ dateRange, dateFrom, dateTo }: DateRangeValues): Bounds {
  const today = startOfToday();
  const rolling = ROLLING_DAYS[dateRange];
  // N days = today and the N - 1 previous days
  if (rolling) return { from: addDays(today, -(rolling - 1)).toISOString() };

  switch (dateRange) {
    case 'today':
      return { from: today.toISOString() };
    case 'yesterday':
      return { from: addDays(today, -1).toISOString(), to: today.toISOString() };
    case 'custom':
      return {
        from: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : undefined,
        to: dateTo ? new Date(`${dateTo}T23:59:59.999`).toISOString() : undefined,
      };
    default:
      return {};
  }
}
