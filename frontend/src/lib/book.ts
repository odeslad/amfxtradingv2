import { apiFetch, apiSend } from './api';

// Types and API of the operator's book of schemes (backend /book, spec 020).

export type Slot = 'T1' | 'T2' | 'T3' | 'RE';
export type Direction = 'buy' | 'sell';
export type Result = Slot | 'Pierde' | 'Empate';
export type EffectiveResult = Result | 'Pendiente';
export type StoredResult = Result | 'auto';
export const SLOTS: readonly Slot[] = ['T1', 'T2', 'T3', 'RE'];
export const RESULTS: readonly Result[] = ['T1', 'T2', 'T3', 'RE', 'Pierde', 'Empate'];
export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export interface BookTrade {
  id: number;
  ticket: number;
  schemeId: number;
  slot: Slot;
  direction: Direction;
  lots: number;
  entry: number;
  sl: number;
  openTime: string;
  closeTime: string | null;
  closePrice: number | null;
  pips: number | null;
  profit: number | null;
  r: number | null;
  balanceAfter: number | null;
  note: string | null;
}

export interface BookScheme {
  id: number;
  number: number;
  start: string;
  end: string | null;
  storedResult: StoredResult;
  result: EffectiveResult;
  note: string | null;
  trades: BookTrade[];
  tradesLine: string;
  tickets: string;
  netEur: number;
  netR: number;
  open: number;
}

export interface BookTotals {
  schemes: number;
  won: number;
  draws: number;
  lost: number;
  pending: number;
  winPct: number;
  netEur: number;
  netR: number;
}

export interface BookPage {
  schemes: BookScheme[];
  total: number;
  totals: BookTotals;
  years: number[];
  year: number | 'all';
  page: number;
  pageSize: number;
  nextNumber: number;
}

export interface SchemeInput {
  number?: number;
  start: string;
  end?: string | null;
  result?: StoredResult;
  note?: string | null;
}

export interface TradeInput {
  schemeId: number;
  slot: Slot;
  direction: Direction;
  entry: number;
  sl: number;
  openTime: string;
  closeTime?: string | null;
  closePrice?: number | null;
  lots?: number | null;
  note?: string | null;
}

export interface TradePreview {
  ticket: number;
  riskBase: number;
  proposedLots: number;
  lots: number;
  pips: number | null;
  profit: number | null;
  r: number | null;
}

// ---- API ----

export const fetchBook = (year: number | 'all' | undefined, page: number, pageSize: PageSize, init?: RequestInit) =>
  apiFetch<BookPage>(`/book/schemes?${year === undefined ? '' : `year=${year}&`}page=${page}&pageSize=${pageSize}`, init);

export const createScheme = (input: SchemeInput) => apiSend<{ scheme: BookScheme }>('/book/schemes', 'POST', input).then(r => r.scheme);
export const updateScheme = (id: number, patch: Partial<SchemeInput>) => apiSend<{ scheme: BookScheme }>(`/book/schemes/${id}`, 'PUT', patch).then(r => r.scheme);
export const deleteScheme = (id: number) => apiSend(`/book/schemes/${id}`, 'DELETE');
export const createTrade = (input: TradeInput) => apiSend<{ trade: BookTrade }>('/book/trades', 'POST', input).then(r => r.trade);
export const updateTrade = (id: number, patch: Partial<Omit<TradeInput, 'schemeId'>>) => apiSend<{ trade: BookTrade }>(`/book/trades/${id}`, 'PUT', patch).then(r => r.trade);
export const deleteTrade = (id: number) => apiSend(`/book/trades/${id}`, 'DELETE');
export const previewTrade = (input: Omit<TradeInput, 'schemeId' | 'note'> & { tradeId?: number }, init?: RequestInit) =>
  apiSend<TradePreview>('/book/preview', 'POST', input, init);

// ---- formatting ----

const nf2 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf1 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const fmtEur = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : nf2.format(v));
export const fmtR = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : `${v >= 0 ? '+' : ''}${nf2.format(v)}R`);
export const fmtR1 = (v: number | null | undefined): string => (v === null || v === undefined ? '…' : `${v >= 0 ? '+' : ''}${nf1.format(v)}`);
export const fmtLots = (v: number): string => nf2.format(v);
export const fmtPrice = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : v.toFixed(4));
export const fmtPips = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : `${v >= 0 ? '+' : ''}${nf1.format(v)}`);

// The book's times carry no timezone (stored as UTC, shown as written).
const pad = (n: number) => String(n).padStart(2, '0');
export const fmtDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};
// dd/mm/yyyy hh:mm, the format the operator writes and reads (24 h, no locale).
export const fmtShort = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};
export const toBookInput = (iso: string | null | undefined): string => (iso ? fmtShort(iso) : '');
// "dd/mm/yyyy hh:mm" (minutes optional) → "YYYY-MM-DD HH:MM" for the API; null when not a valid date.
export const parseBookInput = (text: string): string | null => {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2})(?::(\d{2}))?\s*$/.exec(text);
  if (!m) return null;
  const [day, month, year, hour, minute] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5] ?? '0')];
  const d = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const valid = d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day && hour < 24 && minute < 60;
  return valid ? `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}` : null;
};

export const resultLabel = (r: EffectiveResult): string => (r === 'Pierde' || r === 'Empate' || r === 'Pendiente' ? r : `Gana ${r}`);
export type ResultTone = 'green' | 'red' | 'gold' | 'muted';
export const resultTone = (r: EffectiveResult): ResultTone => (r === 'Pierde' ? 'red' : r === 'Empate' ? 'gold' : r === 'Pendiente' ? 'muted' : 'green');
