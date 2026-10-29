import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileWatcher, type BridgeTrade } from './file-watcher';

vi.mock('../store/liveness', () => ({ touchSync: vi.fn() }));

let dir: string;
let tick = 0;

const write = (name: string, content: unknown) => {
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(content));
  // A distinct mtime per write, as the EA's rewrites are seconds apart.
  tick += 10;
  const time = new Date(Date.UTC(2026, 9, 29, 0, 0, tick));
  fs.utimesSync(file, time, time);
};

const poll = (watcher: FileWatcher): Promise<void> =>
  (watcher as unknown as { poll(): Promise<void> }).poll();

const trade = (ticket: number) => ({ ticket, type: 0, profit: 10 }) as unknown as BridgeTrade;

describe('FileWatcher history and account', () => {
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fw-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('polls every 5 s by default', () => {
    expect((new FileWatcher('b', dir) as unknown as { intervalMs: number }).intervalMs).toBe(5_000);
  });

  it('hands an unchanged history only once, even when the EA rewrites the same content', async () => {
    const watcher = new FileWatcher('b', dir);
    const handler = vi.fn().mockResolvedValue(undefined);
    watcher.onHistory(handler);
    write('history.json', [trade(1)]);
    await poll(watcher);
    await poll(watcher);
    write('history.json', [trade(1)]);
    await poll(watcher);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('hands a history whose content changed', async () => {
    const watcher = new FileWatcher('b', dir);
    const handler = vi.fn().mockResolvedValue(undefined);
    watcher.onHistory(handler);
    write('history.json', [trade(1)]);
    await poll(watcher);
    write('history.json', [trade(1), trade(2)]);
    await poll(watcher);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[1][0]).toHaveLength(2);
  });

  it('retries a history whose handler failed', async () => {
    const watcher = new FileWatcher('b', dir);
    const handler = vi.fn().mockRejectedValueOnce(new Error('db down')).mockResolvedValue(undefined);
    watcher.onHistory(handler);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    write('history.json', [trade(1)]);
    await poll(watcher);
    await poll(watcher);
    await poll(watcher);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('skips an unchanged account the same way', async () => {
    const watcher = new FileWatcher('b', dir);
    const handler = vi.fn().mockResolvedValue(undefined);
    watcher.onAccount(handler);
    write('account.json', { balance: 100 });
    await poll(watcher);
    write('account.json', { balance: 100 });
    await poll(watcher);
    write('account.json', { balance: 120 });
    await poll(watcher);
    expect(handler.mock.calls.map(c => c[0].balance)).toEqual([100, 120]);
  });
});
