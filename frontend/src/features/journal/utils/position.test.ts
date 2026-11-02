import { describe, it, expect } from 'vitest';
import { pricePrecision, tpForRatio, SETUP_LEVEL_KEYS, TP_RATIOS } from './position';

describe('pricePrecision', () => {
  it('quotes JPY pairs with 3 decimals and the rest with 5', () => {
    expect(pricePrecision('USDJPY')).toBe(3);
    expect(pricePrecision('eurjpy.r')).toBe(3);
    expect(pricePrecision('EURUSD')).toBe(5);
    expect(pricePrecision('gbpchf')).toBe(5);
  });
});

describe('tpForRatio', () => {
  it('places a buy TP above the entry by ratio × the SL distance', () => {
    expect(tpForRatio(1.1000, 1.0950, true, 2, 5)).toBe(1.11);
    expect(tpForRatio(1.1000, 1.0950, true, 3, 5)).toBe(1.115);
  });

  it('places a sell TP below the entry by ratio × the SL distance', () => {
    expect(tpForRatio(1.1000, 1.1050, false, 2, 5)).toBe(1.09);
    expect(tpForRatio(1.1000, 1.1050, false, 3, 5)).toBe(1.085);
  });

  it('rounds to the symbol precision', () => {
    expect(tpForRatio(150.123, 149.876, true, 2, 3)).toBe(150.617);
    expect(tpForRatio(1.123456, 1.123000, true, 2, 5)).toBe(1.12437);
  });

  it('returns null without two finite prices or when the SL sits on the entry', () => {
    expect(tpForRatio(NaN, 1.1, true, 2, 5)).toBeNull();
    expect(tpForRatio(1.1, NaN, true, 2, 5)).toBeNull();
    expect(tpForRatio(1.1, 1.1, true, 2, 5)).toBeNull();
  });
});

describe('constants', () => {
  it('exposes the four level keys and the two ratios', () => {
    expect([...SETUP_LEVEL_KEYS]).toEqual(['ECC', 'EMA', 'EVL', 'MHL']);
    expect([...TP_RATIOS]).toEqual([2, 3]);
  });
});
