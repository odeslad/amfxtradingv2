import { describe, it, expect } from 'vitest';
import {
  isAllowedOrigin, tokenFromCookie, sendDecision, parseSubscription,
  SKIP_ABOVE_BYTES, KILL_ABOVE_BYTES, SUBSCRIBE_MAX_PAIRS,
} from './policy';

describe('isAllowedOrigin', () => {
  it('accepts the production app and the local HTTPS dev host', () => {
    expect(isAllowedOrigin('https://app-v2.amfxtrading.com')).toBe(true);
    expect(isAllowedOrigin('https://local.amfxtrading.com:5174')).toBe(true);
  });

  it('rejects other sites, look-alikes and a missing header', () => {
    expect(isAllowedOrigin('https://evil.com')).toBe(false);
    expect(isAllowedOrigin('https://amfxtrading.com.evil.com')).toBe(false);
    expect(isAllowedOrigin('http://localhost:5174')).toBe(false);
    expect(isAllowedOrigin(undefined)).toBe(false);
    expect(isAllowedOrigin('')).toBe(false);
  });
});

describe('tokenFromCookie', () => {
  it('finds the token wherever it sits in the header', () => {
    expect(tokenFromCookie('token=abc')).toBe('abc');
    expect(tokenFromCookie('a=1; token=abc; b=2')).toBe('abc');
    expect(tokenFromCookie('a=1;token=abc')).toBe('abc');
  });

  it('keeps the raw value, equals signs included', () => {
    expect(tokenFromCookie('token=x.y.z==')).toBe('x.y.z==');
  });

  it('returns null when absent, empty or only a prefix match', () => {
    expect(tokenFromCookie(undefined)).toBeNull();
    expect(tokenFromCookie('')).toBeNull();
    expect(tokenFromCookie('a=1; b=2')).toBeNull();
    expect(tokenFromCookie('token')).toBeNull();
    expect(tokenFromCookie('mytoken=abc')).toBeNull();
  });
});

describe('sendDecision', () => {
  it('sends up to 1 MB, skips up to 8 MB, terminates beyond', () => {
    expect(sendDecision(0)).toBe('send');
    expect(sendDecision(SKIP_ABOVE_BYTES)).toBe('send');
    expect(sendDecision(SKIP_ABOVE_BYTES + 1)).toBe('skip');
    expect(sendDecision(KILL_ABOVE_BYTES)).toBe('skip');
    expect(sendDecision(KILL_ABOVE_BYTES + 1)).toBe('terminate');
  });
});

describe('parseSubscription', () => {
  const frame = (ticks: unknown, type: unknown = 'subscribe') => JSON.stringify({ type, ticks });
  const pair = (broker: string, symbol: string) => ({ broker, symbol });

  it('returns the broker|symbol keys of a valid frame, deduplicated', () => {
    const keys = parseSubscription(frame([pair('solidary III', 'EURUSD'), pair('FTMO', 'XAUUSD'), pair('FTMO', 'XAUUSD')]));
    expect(keys).toEqual(new Set(['solidary III|EURUSD', 'FTMO|XAUUSD']));
  });

  it('accepts an empty list as "no ticks"', () => {
    expect(parseSubscription(frame([]))).toEqual(new Set());
  });

  it('accepts a Buffer like the ws library delivers', () => {
    expect(parseSubscription(Buffer.from(frame([pair('a', 'b')])))).toEqual(new Set(['a|b']));
  });

  it('rejects too many pairs', () => {
    const many = Array.from({ length: SUBSCRIBE_MAX_PAIRS + 1 }, (_, i) => pair('b', `S${i}`));
    expect(parseSubscription(frame(many))).toBeNull();
    expect(parseSubscription(frame(many.slice(1)))?.size).toBe(SUBSCRIBE_MAX_PAIRS);
  });

  it('rejects an unknown type, a missing or non-array list and non-JSON', () => {
    expect(parseSubscription(frame([pair('a', 'b')], 'unsubscribe'))).toBeNull();
    expect(parseSubscription(JSON.stringify({ type: 'subscribe' }))).toBeNull();
    expect(parseSubscription(frame('EURUSD'))).toBeNull();
    expect(parseSubscription('not json')).toBeNull();
    expect(parseSubscription(JSON.stringify(null))).toBeNull();
    expect(parseSubscription(JSON.stringify([]))).toBeNull();
  });

  it('rejects a pair with bad types, empty or oversized names', () => {
    expect(parseSubscription(frame([{ broker: 'a' }]))).toBeNull();
    expect(parseSubscription(frame([{ broker: 1, symbol: 'b' }]))).toBeNull();
    expect(parseSubscription(frame([pair('', 'b')]))).toBeNull();
    expect(parseSubscription(frame([pair('a', 'x'.repeat(65))]))).toBeNull();
    expect(parseSubscription(frame(['a|b']))).toBeNull();
    expect(parseSubscription(frame([null]))).toBeNull();
  });
});
