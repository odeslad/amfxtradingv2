import { getPipSize } from '../indicators/pip-size';

export interface SizingInput {
  balance: number;
  riskPct: number;
  // Price of a pending order, else the current bid.
  entryPrice: number;
  slPrice: number;
  symbol: string;
  accountCurrency: string;
  bids: Map<string, number>;
}

export type SizingRefusal = 'not_forex' | 'zero_stop' | 'no_conversion';

export type SizingResult =
  | { ok: true; lots: number }
  | { ok: false; reason: SizingRefusal; error: string };

const CURRENCIES: ReadonlySet<string> = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD']);
const CONTRACT_SIZE = 100_000;
const MIN_LOTS = 0.01;

const refuse = (reason: SizingRefusal, error: string): SizingResult => ({ ok: false, reason, error });

// Exact pair first, then the same pair under a broker suffix (EURJPY.r).
function priceOf(pair: string, bids: Map<string, number>): number | null {
  const exact = bids.get(pair);
  if (exact) return exact;
  for (const [symbol, bid] of bids) {
    if (bid && symbol.toUpperCase().startsWith(pair)) return bid;
  }
  return null;
}

// Value of one pip of one lot, in the account currency; null when it cannot be converted.
function pipValuePerLot(pipSize: number, quote: string, account: string, bids: Map<string, number>): number | null {
  const inQuote = pipSize * CONTRACT_SIZE;
  if (quote === account) return inQuote;
  const direct = priceOf(`${quote}${account}`, bids);
  if (direct) return inQuote * direct;
  const inverse = priceOf(`${account}${quote}`, bids);
  if (inverse) return inQuote / inverse;
  return null;
}

// Forex only: the contract size and pip are assumptions that do not hold for
// metals, indices or crypto, so those are refused instead of mis-sized.
export function calculateLots({ balance, riskPct, entryPrice, slPrice, symbol, accountCurrency, bids }: SizingInput): SizingResult {
  const pair = symbol.toUpperCase().slice(0, 6);
  const base = pair.slice(0, 3);
  const quote = pair.slice(3, 6);
  if (pair.length < 6 || !CURRENCIES.has(base) || !CURRENCIES.has(quote)) {
    return refuse('not_forex', `Risk % sizing supports forex pairs only (got ${symbol}); use fixed lots`);
  }

  const pipSize = getPipSize(pair);
  const slPips = Math.abs(entryPrice - slPrice) / pipSize;
  if (slPips === 0) return refuse('zero_stop', 'SL must differ from the entry price');

  const account = accountCurrency.toUpperCase();
  const pipValue = pipValuePerLot(pipSize, quote, account, bids);
  if (pipValue === null) {
    return refuse('no_conversion', `Cannot size ${symbol} on a ${account} account: no ${quote}${account} or ${account}${quote} price yet`);
  }

  const lots = (balance * riskPct / 100) / (slPips * pipValue);
  return { ok: true, lots: Math.max(MIN_LOTS, Math.round(lots * 100) / 100) };
}
