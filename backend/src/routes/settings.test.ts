import { describe, it, expect } from 'vitest';
import { parseDisplay, parsePresets } from './settings';
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

describe('parsePresets', () => {
  const broker = { broker: 'ftmo', enabled: true, lotsMode: 'risk_pct', lots: 1 };

  it('accepts a list and trims the names', () => {
    const presets = parsePresets([{ id: 3, name: ' operaciones 1% ', brokers: [broker] }, { name: 'operaciones 0.5%', brokers: [] }]);
    expect(presets).toEqual([
      { id: 3, name: 'operaciones 1%', brokers: [broker] },
      { id: undefined, name: 'operaciones 0.5%', brokers: [] },
    ]);
  });

  it('rejects an empty list, so one preset always remains', () => {
    expect(() => parsePresets([])).toThrow(BadRequest);
  });

  it('rejects repeated names', () => {
    expect(() => parsePresets([{ name: 'A', brokers: [] }, { name: 'A ', brokers: [] }])).toThrow(BadRequest);
  });

  it('rejects an empty or too long name', () => {
    expect(() => parsePresets([{ name: '   ', brokers: [] }])).toThrow(BadRequest);
    expect(() => parsePresets([{ name: 'x'.repeat(41), brokers: [] }])).toThrow(BadRequest);
  });

  it('rejects a bad broker item', () => {
    expect(() => parsePresets([{ name: 'A', brokers: [{ ...broker, lotsMode: 'all' }] }])).toThrow(BadRequest);
  });
});
