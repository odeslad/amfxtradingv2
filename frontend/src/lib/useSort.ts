import { useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc';

export interface SortColumn<T, K extends string> {
  key: K;
  label: string;
  value: (row: T) => string | number | null | undefined;
}

interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

const compareValues = (a: string | number | null | undefined, b: string | number | null | undefined): number => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
};

export function useSort<T, K extends string>(
  rows: T[],
  columns: SortColumn<T, K>[],
  initial: SortState<K>,
) {
  const [sort, setSort] = useState<SortState<K>>(initial);

  const toggle = (key: K) =>
    setSort(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));

  const sorted = useMemo(() => {
    const column = columns.find(c => c.key === sort.key);
    if (!column) return rows;
    const sign = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = column.value(a);
      const vb = column.value(b);
      if (va == null || vb == null) return compareValues(va, vb);
      return sign * compareValues(va, vb);
    });
  }, [rows, columns, sort]);

  return { sorted, sort, toggle };
}
