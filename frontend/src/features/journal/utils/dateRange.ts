export type DateRange =
  | ''
  | 'today'
  | 'yesterday'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'this_year'
  | 'custom';

export const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: '', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_week', label: 'Last week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_3_months', label: 'Last 3 months' },
  { value: 'this_year', label: 'This year' },
  { value: 'custom', label: 'Custom' },
];

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

  switch (dateRange) {
    case 'today':
      return { from: today.toISOString() };
    case 'yesterday':
      return { from: addDays(today, -1).toISOString(), to: today.toISOString() };
    case 'last_week': {
      const daysSinceMonday = (today.getDay() + 6) % 7;
      const lastMonday = addDays(today, -daysSinceMonday - 7);
      return { from: lastMonday.toISOString(), to: addDays(lastMonday, 7).toISOString() };
    }
    case 'this_month':
      return { from: new Date(today.getFullYear(), today.getMonth(), 1).toISOString() };
    case 'last_month': {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const next = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: first.toISOString(), to: next.toISOString() };
    }
    case 'last_3_months':
      return { from: new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString() };
    case 'this_year':
      return { from: new Date(today.getFullYear(), 0, 1).toISOString() };
    case 'custom':
      return {
        from: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : undefined,
        to: dateTo ? new Date(`${dateTo}T23:59:59.999`).toISOString() : undefined,
      };
    default:
      return {};
  }
}
