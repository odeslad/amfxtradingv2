import { describe, it, expect } from 'vitest';
import { isAllowedOrigin, tokenFromCookie, sendDecision, SKIP_ABOVE_BYTES, KILL_ABOVE_BYTES } from './policy';

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
