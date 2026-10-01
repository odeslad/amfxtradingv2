import { describe, it, expect } from 'vitest';
import * as p from './parse';
import { BadRequest } from './errors';

const rejects = (fn: () => unknown, message: string) => {
  expect(fn).toThrowError(BadRequest);
  expect(fn).toThrowError(message);
};

describe('singleQuery / requiredQuery', () => {
  it('returns the value, undefined when absent, and rejects a repeated key', () => {
    expect(p.singleQuery({ a: 'x' }, 'a')).toBe('x');
    expect(p.singleQuery({}, 'a')).toBeUndefined();
    rejects(() => p.singleQuery({ a: ['x', 'y'] }, 'a'), 'a must be a single value');
    rejects(() => p.requiredQuery({ a: '' }, 'a'), 'a is required');
  });
});

describe('intParam', () => {
  it('defaults, parses, clamps and bounds', () => {
    expect(p.intParam(undefined, 'limit', { default: 200 })).toBe(200);
    expect(p.intParam('50', 'limit')).toBe(50);
    expect(p.intParam('9999', 'limit', { max: 1000, clamp: true })).toBe(1000);
    rejects(() => p.intParam('9999', 'limit', { max: 1000 }), 'limit must be <= 1000');
    rejects(() => p.intParam('-1', 'offset', { min: 0 }), 'offset must be >= 0');
    rejects(() => p.intParam('abc', 'limit'), 'limit must be an integer');
    rejects(() => p.intParam('1.5', 'limit'), 'limit must be an integer');
  });
});

describe('epochParam / dateParam', () => {
  it('converts epoch seconds and ISO dates, rejecting junk', () => {
    expect(p.epochParam('1751328000', 'before')).toEqual(new Date(1751328000 * 1000));
    rejects(() => p.epochParam('x', 'before'), 'before must be an integer');
    rejects(() => p.epochParam('-5', 'after'), 'after must be >= 1');
    expect(p.dateParam('2026-06-01T00:00:00Z', 'from')).toEqual(new Date('2026-06-01T00:00:00Z'));
    rejects(() => p.dateParam('notadate', 'from'), 'from must be a valid date');
    rejects(() => p.dateParam('2026-13-45', 'to'), 'to must be a valid date');
  });
});

describe('oneOf / optionalOneOf', () => {
  it('accepts listed values only', () => {
    expect(p.oneOf('net', 'pnlMode', ['net', 'gross'] as const)).toBe('net');
    rejects(() => p.oneOf('euros', 'pnlMode', ['net', 'gross'] as const), 'pnlMode must be one of net, gross');
    expect(p.optionalOneOf(undefined, 'k', ['a'] as const)).toBeUndefined();
  });
});

describe('numbers, integers, strings, booleans, body', () => {
  it('finiteNumber', () => {
    expect(p.finiteNumber(0.1, 'lots', { positive: true })).toBe(0.1);
    rejects(() => p.finiteNumber(0, 'lots', { positive: true }), 'lots must be > 0');
    rejects(() => p.finiteNumber('x', 'lots'), 'lots must be a number');
    rejects(() => p.finiteNumber(NaN, 'lots'), 'lots must be a number');
    rejects(() => p.finiteNumber(-1, 'tp', { min: 0 }), 'tp must be >= 0');
  });
  it('integer', () => {
    expect(p.integer(5, 'ticket')).toBe(5);
    rejects(() => p.integer(1.5, 'ticket'), 'ticket must be an integer');
    rejects(() => p.integer('abc', 'ticket'), 'ticket must be an integer');
  });
  it('strings and booleans', () => {
    expect(p.nonEmptyString('ftmo', 'broker')).toBe('ftmo');
    rejects(() => p.nonEmptyString('', 'broker'), 'broker is required');
    rejects(() => p.optionalString(7, 'color'), 'color must be a string');
    rejects(() => p.optionalBoolean('yes', 'enabled'), 'enabled must be a boolean');
    expect(p.optionalBoolean(true, 'enabled')).toBe(true);
  });
  it('bodyRecord', () => {
    rejects(() => p.bodyRecord([]), 'body must be an object');
    expect(p.bodyRecord({ a: 1 })).toEqual({ a: 1 });
  });
});
