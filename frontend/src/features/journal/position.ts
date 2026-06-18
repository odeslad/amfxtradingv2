export interface Position {
  ticket: number;
  broker?: string;
  currency?: string;
  symbol: string;
  type: number;
  lots: number;
  openPrice: number;
  sl: number;
  tp: number;
  profit: number;
  swap: number;
  commission: number;
  openTime: string;
}

export const TYPE_LABEL: Record<number, string> = { 0: 'Buy', 1: 'Sell' };

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CHF: 'Fr',
  AUD: 'A$',
  CAD: 'C$',
};

export function currencySymbol(code?: string): string {
  if (!code) return '';
  return CURRENCY_SYMBOL[code] ?? code;
}

export function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

export function fmtPnl(n: number, currency?: string): string {
  const sym = currencySymbol(currency);
  return (n >= 0 ? '+' : '') + fmt(n) + (sym ? ` ${sym}` : '');
}

export function fmtDate(raw: string): string {
  return raw.replace(/\./g, '-').slice(0, 16);
}

export function openTimeMs(raw: string): number {
  const ms = Date.parse(raw.replace(/\./g, '-').replace(' ', 'T'));
  return Number.isNaN(ms) ? 0 : ms;
}
