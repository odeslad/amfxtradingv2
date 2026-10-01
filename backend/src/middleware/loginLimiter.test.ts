import { describe, it, expect } from 'vitest';
import { isBlocked, recordFailure, clearFailures } from './loginLimiter';

const MIN = 60_000;

describe('loginLimiter', () => {
  it('blocks after 10 failures inside the 15-minute window', () => {
    const key = 'ip-a|a@test';
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) {
      expect(isBlocked(key, t0 + i * MIN)).toBe(false);
      recordFailure(key, t0 + i * MIN);
    }
    expect(isBlocked(key, t0 + 10 * MIN)).toBe(true);
    expect(isBlocked(key, t0 + 14 * MIN)).toBe(true);
  });

  it('releases once the window has passed and starts a fresh count', () => {
    const key = 'ip-b|b@test';
    const t0 = 2_000_000;
    for (let i = 0; i < 10; i++) recordFailure(key, t0);
    expect(isBlocked(key, t0 + 14 * MIN)).toBe(true);
    expect(isBlocked(key, t0 + 16 * MIN)).toBe(false);
    recordFailure(key, t0 + 16 * MIN);
    expect(isBlocked(key, t0 + 17 * MIN)).toBe(false);
  });

  it('a failure after the window restarts the count from one', () => {
    const key = 'ip-c|c@test';
    const t0 = 3_000_000;
    for (let i = 0; i < 9; i++) recordFailure(key, t0);
    recordFailure(key, t0 + 20 * MIN);            // new window
    recordFailure(key, t0 + 20 * MIN);
    expect(isBlocked(key, t0 + 21 * MIN)).toBe(false);
  });

  it('clearFailures resets the key', () => {
    const key = 'ip-d|d@test';
    for (let i = 0; i < 10; i++) recordFailure(key, 4_000_000);
    expect(isBlocked(key, 4_000_000)).toBe(true);
    clearFailures(key);
    expect(isBlocked(key, 4_000_000)).toBe(false);
  });

  it('keys are independent', () => {
    for (let i = 0; i < 10; i++) recordFailure('ip-e|e@test', 5_000_000);
    expect(isBlocked('ip-e|e@test', 5_000_000)).toBe(true);
    expect(isBlocked('ip-f|e@test', 5_000_000)).toBe(false);
    expect(isBlocked('ip-e|other@test', 5_000_000)).toBe(false);
  });
});
