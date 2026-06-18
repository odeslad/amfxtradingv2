export interface Position {
  ticket: number;
  broker?: string;
  currency?: string;
  brokerOffset?: number;
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

const pad = (n: number): string => String(n).padStart(2, '0');

export function fmtLocalTime(raw: string, brokerOffsetSec = 0): string {
  const m = raw.match(/(\d{4})[.\-](\d{2})[.\-](\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return fmtDate(raw);
  const [, y, mo, d, h, mi] = m.map(Number);
  const utcMs = Date.UTC(y, mo - 1, d, h, mi) - brokerOffsetSec * 1000;
  const local = new Date(utcMs);
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())} ${pad(local.getHours())}:${pad(local.getMinutes())}`;
}

export function openTimeMs(raw: string): number {
  const ms = Date.parse(raw.replace(/\./g, '-').replace(' ', 'T'));
  return Number.isNaN(ms) ? 0 : ms;
}
