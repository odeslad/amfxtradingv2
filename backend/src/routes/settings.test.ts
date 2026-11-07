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

describe('parseDisplay setupLevels', () => {
  it('leaves it undefined when absent, so the stored value is kept', () => {
    expect(parseDisplay({ pnlMode: 'net' }).setupLevels).toBeUndefined();
  });

  it('accepts known keys, deduplicated and in canonical order', () => {
    expect(parseDisplay({ pnlMode: 'net', setupLevels: ['MHL', 'ECC', 'MHL'] }).setupLevels).toEqual(['ECC', 'MHL']);
  });

  it('accepts an empty list', () => {
    expect(parseDisplay({ pnlMode: 'net', setupLevels: [] }).setupLevels).toEqual([]);
  });

  it('rejects an unknown key or a non-array with 400', () => {
    expect(() => parseDisplay({ pnlMode: 'net', setupLevels: ['XXX'] })).toThrow(BadRequest);
    expect(() => parseDisplay({ pnlMode: 'net', setupLevels: 'ECC' })).toThrow(BadRequest);
  });
});

describe('parseDisplay fibLevels', () => {
  it('leaves it undefined when absent, so the stored value is kept', () => {
    expect(parseDisplay({ pnlMode: 'net' }).fibLevels).toBeUndefined();
  });

  it('accepts catalogue values, deduplicated and in canonical order', () => {
    expect(parseDisplay({ pnlMode: 'net', fibLevels: [161.8, 0, 50, 100, 50] }).fibLevels).toEqual([0, 50, 100, 161.8]);
  });

  it('forces the 0 and 100 anchors in', () => {
    expect(parseDisplay({ pnlMode: 'net', fibLevels: [61.8] }).fibLevels).toEqual([0, 61.8, 100]);
    expect(parseDisplay({ pnlMode: 'net', fibLevels: [] }).fibLevels).toEqual([0, 100]);
  });

  it('rejects a value outside the catalogue, a string or a non-array with 400', () => {
    expect(() => parseDisplay({ pnlMode: 'net', fibLevels: [33] })).toThrow(BadRequest);
    expect(() => parseDisplay({ pnlMode: 'net', fibLevels: ['50'] })).toThrow(BadRequest);
    expect(() => parseDisplay({ pnlMode: 'net', fibLevels: 50 })).toThrow(BadRequest);
  });
});

describe('parseDisplay emaTrades', () => {
  const valid = { fast: 24, slow: 48, entryPips: 5, hours: 24, count: 3 };

  it('leaves it undefined when absent, so the stored value is kept', () => {
    expect(parseDisplay({ pnlMode: 'net' }).emaTrades).toBeUndefined();
  });

  it('accepts a valid object, zero pips included', () => {
    expect(parseDisplay({ pnlMode: 'net', emaTrades: valid }).emaTrades).toEqual(valid);
    expect(parseDisplay({ pnlMode: 'net', emaTrades: { ...valid, entryPips: 0 } }).emaTrades?.entryPips).toBe(0);
  });

  it('rejects equal EMAs, a count over 10, hours over 720, negative pips or a non-integer period with 400', () => {
    expect(() => parseDisplay({ pnlMode: 'net', emaTrades: { ...valid, slow: 24 } })).toThrow(BadRequest);
    expect(() => parseDisplay({ pnlMode: 'net', emaTrades: { ...valid, count: 11 } })).toThrow(BadRequest);
    expect(() => parseDisplay({ pnlMode: 'net', emaTrades: { ...valid, hours: 721 } })).toThrow(BadRequest);
    expect(() => parseDisplay({ pnlMode: 'net', emaTrades: { ...valid, entryPips: -1 } })).toThrow(BadRequest);
    expect(() => parseDisplay({ pnlMode: 'net', emaTrades: { ...valid, fast: 2.5 } })).toThrow(BadRequest);
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
