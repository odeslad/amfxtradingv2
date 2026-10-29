import { describe, it, expect } from 'vitest';
import { parseDisplay } from './settings';
import { BadRequest } from '../middleware/errors';

describe('parseDisplay showSpread', () => {
  it('leaves it undefined when absent, so the stored value is kept', () => {
    expect(parseDisplay({ pnlMode: 'net' }).showSpread).toBeUndefined();
  });

  it('accepts a boolean', () => {
    expect(parseDisplay({ pnlMode: 'net', showSpread: true }).showSpread).toBe(true);
    expect(parseDisplay({ pnlMode: 'net', showSpread: false }).showSpread).toBe(false);
  });

  it('rejects a non-boolean with 400', () => {
    expect(() => parseDisplay({ pnlMode: 'net', showSpread: 'yes' })).toThrow(BadRequest);
  });
});
