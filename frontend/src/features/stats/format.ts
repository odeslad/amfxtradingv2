import { fmt } from '../journal/utils/position';

export const fmtPct = (n: number | null): string =>
  n === null ? '—' : `${n >= 0 ? '+' : ''}${fmt(n, 2)} %`;
