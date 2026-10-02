import { describe, it, expect } from 'vitest';
import { calculateLots, type SizingInput } from './sizing';

const bids = (pairs: Record<string, number>) => new Map(Object.entries(pairs));

const input = (over: Partial<SizingInput>): SizingInput => ({
  balance: 10_000, riskPct: 1, entryPrice: 1.1020, slPrice: 1.1000,
  symbol: 'EURUSD', accountCurrency: 'USD', bids: bids({}), ...over,
});

const lots = (over: Partial<SizingInput>) => calculateLots(input(over));

describe('calculateLots — sizes that must not change', () => {
  it('quote currency equals account currency: 1 % of 10 000 USD with a 20-pip SL on EURUSD → 0.5 lots', () => {
    // risk 100 USD / (20 pips × 10 USD per pip per lot) = 0.5
    expect(lots({})).toEqual({ ok: true, lots: 0.5 });
  });

  it('JPY pairs use a 0.01 pip and convert through the inverse pair', () => {
    // USDJPY, account USD, bid 150: pip value per lot = 1000 JPY / 150 = 6.666… USD
    // risk 100 USD, SL 0.20 = 20 pips → 100 / (20 × 6.666…) = 0.75
    expect(lots({ symbol: 'USDJPY', entryPrice: 149.80, slPrice: 150.00, bids: bids({ USDJPY: 150 }) }))
      .toEqual({ ok: true, lots: 0.75 });
  });

  it('converts through the inverse pair (account EUR, quote USD, EURUSD streaming)', () => {
    // pip value 10 USD / EURUSD 1.25 = 8 EUR per pip per lot; risk 100 EUR, SL 25 pips → 0.5
    expect(lots({ accountCurrency: 'EUR', entryPrice: 1.2525, slPrice: 1.2500, bids: bids({ EURUSD: 1.25 }) }))
      .toEqual({ ok: true, lots: 0.5 });
  });

  it('converts through the direct pair when it is the one streaming', () => {
    // GBPJPY, account USD: pip value 1000 JPY × JPYUSD 0.0067 = 6.7 USD; SL 50 pips → 0.2985… → 0.3
    expect(lots({ symbol: 'GBPJPY', entryPrice: 189.50, slPrice: 190.00, bids: bids({ JPYUSD: 0.0067 }) }))
      .toEqual({ ok: true, lots: 0.3 });
  });

  it('never goes below 0.01 lots and rounds to two decimals', () => {
    expect(lots({ balance: 100, riskPct: 0.1, entryPrice: 1.1100 })).toEqual({ ok: true, lots: 0.01 });
    expect(lots({ entryPrice: 1.1033 })).toEqual({ ok: true, lots: 0.3 });   // 100 / (33 × 10) = 0.303…
  });
});

describe('calculateLots — entry price', () => {
  it('sizes a pending order from its own price, not from the market', () => {
    // Buy limit at 1.0900 with SL 1.0880 (20 pips) → 0.5, whatever the bid is.
    expect(lots({ entryPrice: 1.0900, slPrice: 1.0880 })).toEqual({ ok: true, lots: 0.5 });
    // The same SL measured from a bid at 1.1020 would be 140 pips → 0.07.
    expect(lots({ entryPrice: 1.1020, slPrice: 1.0880 })).toEqual({ ok: true, lots: 0.07 });
  });
});

describe('calculateLots — refusals', () => {
  it('refuses when no conversion pair is streaming, naming both pairs', () => {
    expect(lots({ symbol: 'GBPCHF', accountCurrency: 'EUR' })).toEqual({
      ok: false, reason: 'no_conversion',
      error: 'Cannot size GBPCHF on a EUR account: no CHFEUR or EURCHF price yet',
    });
  });

  it('refuses a stop at the entry price', () => {
    expect(lots({ entryPrice: 1.1000, slPrice: 1.1000 })).toEqual({
      ok: false, reason: 'zero_stop', error: 'SL must differ from the entry price',
    });
  });

  it('refuses instruments that are not a pair of known currencies', () => {
    for (const symbol of ['XAUUSD', 'US30', 'BTCUSD', 'USDMXN', 'EUR']) {
      expect(lots({ symbol })).toEqual({
        ok: false, reason: 'not_forex',
        error: `Risk % sizing supports forex pairs only (got ${symbol}); use fixed lots`,
      });
    }
  });
});

describe('calculateLots — broker suffixes', () => {
  it('sizes a suffixed symbol by its first six letters', () => {
    expect(lots({ symbol: 'EURUSD.r' })).toEqual({ ok: true, lots: 0.5 });
    expect(lots({ symbol: 'eurusd' })).toEqual({ ok: true, lots: 0.5 });
  });

  it('finds the conversion pair under a suffixed key', () => {
    expect(lots({ symbol: 'USDJPY.r', entryPrice: 149.80, slPrice: 150.00, bids: bids({ 'USDJPY.r': 150 }) }))
      .toEqual({ ok: true, lots: 0.75 });
  });
});
