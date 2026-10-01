import { describe, it, expect } from 'vitest';
import { calculateLots } from './sizing';

// Characterisation of today's forex-only sizing (audit BE-07 lists its limits).
const bids = (pairs: Record<string, number>) => new Map(Object.entries(pairs));

describe('calculateLots', () => {
  it('quote currency equals account currency: 1 % of 10 000 USD with a 20-pip SL on EURUSD → 0.5 lots', () => {
    // risk 100 USD / (20 pips × 10 USD per pip per lot) = 0.5
    expect(calculateLots(10_000, 1, 1.1000, 1.1020, 'EURUSD', 'USD', bids({}))).toBe(0.5);
  });

  it('JPY pairs use a 0.01 pip and convert through the inverse pair', () => {
    // USDJPY, account USD, bid 150: pip value per lot = 1000 JPY / 150 = 6.666… USD
    // risk 100 USD, SL 0.20 = 20 pips → 100 / (20 × 6.666…) = 0.75
    expect(calculateLots(10_000, 1, 150.00, 149.80, 'USDJPY', 'USD', bids({ USDJPY: 150 }))).toBe(0.75);
  });

  it('converts through the inverse pair (account EUR, quote USD, EURUSD streaming)', () => {
    // pip value 10 USD / EURUSD 1.25 = 8 EUR per pip per lot
    // risk 100 EUR, SL 25 pips → 100 / (25 × 8) = 0.5
    expect(calculateLots(10_000, 1, 1.2500, 1.2525, 'EURUSD', 'EUR', bids({ EURUSD: 1.25 }))).toBe(0.5);
  });

  it('converts through the direct pair when it is the one streaming', () => {
    // GBPJPY, account USD, quote JPY: pip value 1000 JPY × JPYUSD 0.0067 = 6.7 USD
    // risk 100 USD, SL 0.50 = 50 pips → 100 / (50 × 6.7) = 0.2985… → 0.3
    expect(calculateLots(10_000, 1, 190.00, 189.50, 'GBPJPY', 'USD', bids({ JPYUSD: 0.0067 }))).toBe(0.3);
  });

  it('falls back to an unconverted pip value when no conversion pair is available (documented limit)', () => {
    // GBPCHF, account EUR, no CHFEUR/EURCHF tick → pip value taken as 10 "CHF" = 10 EUR
    expect(calculateLots(10_000, 1, 1.1000, 1.1020, 'GBPCHF', 'EUR', bids({}))).toBe(0.5);
  });

  it('never goes below 0.01 lots and rounds to two decimals', () => {
    expect(calculateLots(100, 0.1, 1.1000, 1.1100, 'EURUSD', 'USD', bids({}))).toBe(0.01);
    expect(calculateLots(10_000, 1, 1.1000, 1.1033, 'EURUSD', 'USD', bids({}))).toBe(0.3);   // 100 / (33 × 10) = 0.303…
  });

  it('a stop at the current price yields the minimum lot instead of dividing by zero', () => {
    expect(calculateLots(10_000, 1, 1.1000, 1.1000, 'EURUSD', 'USD', bids({}))).toBe(0.01);
  });
});
