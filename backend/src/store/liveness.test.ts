import { describe, it, expect } from 'vitest';
import { healthReport, register, setPipeState, touchTick, touchSync, snapshot, pipeStateOf, isPipeLive, type BrokerLiveness } from './liveness';

const now = new Date('2026-10-02T10:00:00Z');
const startedAt = new Date('2026-10-02T08:33:20Z');
const secondsAgo = (s: number): Date => new Date(now.getTime() - s * 1000);

const broker = (over: Partial<BrokerLiveness> = {}): BrokerLiveness => ({
  pipe: 'connected', lastTickAt: secondsAgo(2), lastSyncAt: secondsAgo(14), watcher: true, ...over,
});

const report = (entries: Record<string, BrokerLiveness>) =>
  healthReport(now, startedAt, new Map(Object.entries(entries)));

describe('healthReport', () => {
  it('is ok when every broker is connected with a fresh tick, and formats ages and uptime', () => {
    const r = report({ darwinex: broker(), ftmo: broker({ lastTickAt: secondsAgo(299) }) });
    expect(r.status).toBe('ok');
    expect(r.uptimeS).toBe(5200);
    expect(r.brokers[0]).toEqual({
      name: 'darwinex', pipe: 'connected',
      lastTickAt: secondsAgo(2).toISOString(), lastSyncAt: secondsAgo(14).toISOString(),
      tickAgeS: 2, syncAgeS: 14,
    });
  });

  it('degrades when a pipe is not connected', () => {
    expect(report({ a: broker(), b: broker({ pipe: 'listening' }) }).status).toBe('degraded');
    expect(report({ a: broker({ pipe: 'error' }) }).status).toBe('degraded');
  });

  it('degrades when the last tick is older than 5 minutes or never arrived', () => {
    expect(report({ a: broker({ lastTickAt: secondsAgo(301) }) }).status).toBe('degraded');
    const never = report({ a: broker({ lastTickAt: null }) });
    expect(never.status).toBe('degraded');
    expect(never.brokers[0].tickAgeS).toBeNull();
    expect(never.brokers[0].lastTickAt).toBeNull();
  });

  it('ignores disabled pipes and a missing sync', () => {
    const r = report({ a: broker({ pipe: 'disabled', lastTickAt: null, lastSyncAt: null, watcher: false }) });
    expect(r.status).toBe('ok');
    expect(r.brokers[0]).toMatchObject({ pipe: 'disabled', tickAgeS: null, syncAgeS: null });
  });

  it('never reports a negative age', () => {
    expect(report({ a: broker({ lastTickAt: secondsAgo(-3) }) }).brokers[0].tickAgeS).toBe(0);
  });
});

describe('store', () => {
  it('registers brokers by feature flags and records state and timestamps', () => {
    register('x', { pipe: true, watcher: true });
    register('y', { pipe: false, watcher: false });
    expect(snapshot().get('x')).toEqual({ pipe: 'listening', lastTickAt: null, lastSyncAt: null, watcher: true });
    expect(snapshot().get('y')?.pipe).toBe('disabled');

    setPipeState('x', 'connected');
    touchTick('x', now);
    touchSync('x', now);
    expect(snapshot().get('x')).toEqual({ pipe: 'connected', lastTickAt: now, lastSyncAt: now, watcher: true });
  });

  it('tells live pipes apart: connected or disabled, never listening or error', () => {
    expect(isPipeLive('connected')).toBe(true);
    expect(isPipeLive('disabled')).toBe(true);
    expect(isPipeLive('listening')).toBe(false);
    expect(isPipeLive('error')).toBe(false);
    expect(pipeStateOf('x')).toBe('connected');
    expect(pipeStateOf('y')).toBe('disabled');
    expect(pipeStateOf('nobody')).toBeNull();
  });

  it('ignores unknown brokers and hands out copies', () => {
    touchTick('nobody');
    expect(snapshot().has('nobody')).toBe(false);
    const copy = snapshot().get('x')!;
    copy.pipe = 'error';
    expect(snapshot().get('x')?.pipe).toBe('connected');
  });
});
