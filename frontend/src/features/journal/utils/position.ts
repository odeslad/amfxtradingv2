export interface Trade {
  ticket: number;
  broker: string;
  symbol: string;
  type: number;
  lots: number;
  openPrice: number;
  closePrice: number;
  sl: number;
  tp: number;
  profit: number;
  swap: number;
  commission: number;
  currency?: string;
  openTime: string;
  closeTime: string;
}

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
  color?: string;
  currentBid?: number | null;
  currentAsk?: number | null;
}

export type PositionColor = 'orange' | 'blue' | 'green' | 'red' | 'gold';

export const POSITION_COLORS: PositionColor[] = ['orange', 'blue', 'green', 'red', 'gold'];

export const POSITION_COLOR_VALUES: Record<PositionColor, string> = {
  orange: 'var(--orange)',
  blue:   'var(--blue)',
  green:  'var(--green)',
  red:    'var(--red)',
  gold:   'var(--gold)',
};

export function nextColor(current?: string): string {
  if (!current) return POSITION_COLORS[0];
  const idx = POSITION_COLORS.indexOf(current as PositionColor);
  if (idx === -1 || idx === POSITION_COLORS.length - 1) return '';
  return POSITION_COLORS[idx + 1];
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

export type PnlMode = 'net' | 'gross' | 'pips' | 'pct';

export const PNL_MODES: PnlMode[] = ['net', 'gross', 'pips', 'pct'];

export const PNL_LABEL: Record<PnlMode, string> = {
  net: 'P&L Net',
  gross: 'P&L Gross',
  pips: 'Pips',
  pct: '% Net',
};

// Net P&L in account currency: market profit plus swap and commission.
export function netPnl(p: Position): number {
  return p.profit + p.swap + p.commission;
}

// Live market quote relevant to closing the position: bid for buys, ask for sells.
export function currentQuote(p: Position): number | null {
  const q = p.type === 0 ? p.currentBid : p.currentAsk;
  return q ?? null;
}

// Raw numeric P&L for a mode. The 'pct' mode needs the account balance; when it's
// missing it falls back to the net currency value so callers never get NaN.
export function calcPnl(p: Position, mode: PnlMode, balance?: number): number {
  if (mode === 'net') return netPnl(p);
  if (mode === 'gross') return p.profit;
  if (mode === 'pct') {
    if (!balance || balance <= 0) return netPnl(p);
    return (netPnl(p) / balance) * 100;
  }
  const pipSize = p.symbol.toUpperCase().includes('JPY') ? 0.01 : 0.0001;
  const closePrice = p.type === 0 ? p.currentBid : p.currentAsk;
  if (closePrice != null) {
    const direction = p.type === 0 ? 1 : -1;
    return direction * (closePrice - p.openPrice) / pipSize;
  }
  return p.profit / (p.lots * pipSize * 100_000);
}

export function fmtPnlMode(p: Position, mode: PnlMode, balance?: number): string {
  const value = calcPnl(p, mode, balance);
  if (mode === 'pips') return (value >= 0 ? '+' : '') + value.toFixed(1) + ' pips';
  if (mode === 'pct' && balance && balance > 0) return (value >= 0 ? '+' : '') + value.toFixed(2) + '%';
  return fmtPnl(value, p.currency);
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
