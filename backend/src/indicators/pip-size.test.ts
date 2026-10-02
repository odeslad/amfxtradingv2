import { describe, it, expect } from 'vitest';
import { getPipSize } from './pip-size';

describe('getPipSize', () => {
  it('reads listed pairs, case-insensitively', () => {
    expect(getPipSize('EURUSD')).toBe(0.0001);
    expect(getPipSize('gbpchf')).toBe(0.0001);
    expect(getPipSize('USDJPY')).toBe(0.01);
    expect(getPipSize('chfjpy')).toBe(0.01);
  });

  it('gives an unlisted JPY-quoted symbol a 0.01 pip and anything else 0.0001', () => {
    expect(getPipSize('SGDJPY')).toBe(0.01);
    expect(getPipSize('USDJPY.r')).toBe(0.01);
    expect(getPipSize('USDMXN')).toBe(0.0001);
    expect(getPipSize('JPYUSD')).toBe(0.0001);
  });
});
