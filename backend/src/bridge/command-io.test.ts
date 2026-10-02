import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  writeCommand, readResult, errorText, discardStaleResult, waitForResult,
  WAIT_BASE_MS, WAIT_PENDING_MS, WAIT_LATE_MS, type CommandResult,
} from './command-io';

let dir: string;
const file = (name: string) => path.join(dir, name);
const put = (name: string, content: string) => fs.writeFileSync(file(name), content);
const exists = (name: string) => fs.existsSync(file(name));

beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmdio-')); });
afterEach(() => { vi.useRealTimers(); fs.rmSync(dir, { recursive: true, force: true }); });

describe('writeCommand', () => {
  it('leaves only command.json with the JSON and replaces an existing one', () => {
    put('command.json', '{"old":true}');
    writeCommand(dir, { action: 'buy', id: 'a1' });
    expect(exists('command.tmp')).toBe(false);
    expect(JSON.parse(fs.readFileSync(file('command.json'), 'utf8'))).toEqual({ action: 'buy', id: 'a1' });
  });
});

describe('readResult', () => {
  it('returns null for a missing, partial or id-less file and parses a complete one', () => {
    expect(readResult(file('result.json'))).toBeNull();
    put('result.json', '{"status":"ok","tick');
    expect(readResult(file('result.json'))).toBeNull();
    put('result.json', '{"status":"ok"}');
    expect(readResult(file('result.json'))).toBeNull();
    put('result.json', '{"status":"error","code":130,"message":"invalid stops","id":"a1"}');
    expect(readResult(file('result.json'))).toEqual({ id: 'a1', status: 'error', code: 130, message: 'invalid stops', ticket: undefined });
  });
});

describe('errorText', () => {
  const r = (over: Partial<CommandResult>): CommandResult => ({ id: 'x', status: 'error', ...over });
  it('wraps the EA message and code', () => {
    expect(errorText(r({ status: 'ok' }))).toBeUndefined();
    expect(errorText(r({ code: 130 }))).toBe('EA error (code 130)');
    expect(errorText(r({ message: 'ticket not found' }))).toBe('EA error: ticket not found');
    expect(errorText(r({ message: 'ticket not found', code: 130 }))).toBe('EA error: ticket not found (code 130)');
    expect(errorText(r({}))).toBe('EA error');
  });
});

describe('discardStaleResult', () => {
  it('removes a leftover result and logs it once; nothing when absent', () => {
    const log = vi.fn();
    discardStaleResult(file('result.json'), log);
    expect(log).not.toHaveBeenCalled();
    put('result.json', '{"status":"ok","ticket":5,"id":"old"}');
    discardStaleResult(file('result.json'), log);
    expect(exists('result.json')).toBe(false);
    expect(log).toHaveBeenCalledWith('discarding stale result id=old status=ok');
  });
});

describe('waitForResult', () => {
  const opts = () => ({ resultPath: file('result.json'), pendingPath: file('pending.json'), id: 'c1' });
  const ok = '{"status":"ok","ticket":42,"id":"c1"}';

  // Polling happens inside a faked setInterval; the flush lets the promise chain settle.
  const advance = async (ms: number) => { await vi.advanceTimersByTimeAsync(ms); };
  const settled = <T,>(p: Promise<T>): { value: () => T | undefined } => {
    let v: T | undefined;
    void p.then(x => { v = x; });
    return { value: () => v };
  };

  beforeEach(() => { vi.useFakeTimers(); });

  it('resolves with the result as soon as it appears and removes the file', async () => {
    const w = settled(waitForResult(opts()));
    await advance(2_000);
    put('result.json', ok);
    await advance(400);
    expect(w.value()).toEqual({ kind: 'result', result: { id: 'c1', status: 'ok', ticket: 42, code: undefined, message: undefined } });
    expect(exists('result.json')).toBe(false);
  });

  it('times out at 10 s without pending and the late watch gives up 60 s later', async () => {
    const w = settled(waitForResult(opts()));
    await advance(WAIT_BASE_MS - 400);
    expect(w.value()).toBeUndefined();
    await advance(800);
    expect(w.value()?.kind).toBe('timeout');
    const late = settled((w.value() as { kind: 'timeout'; late: Promise<CommandResult | null> }).late);
    await advance(WAIT_LATE_MS - 1_000);
    expect(late.value()).toBeUndefined();
    await advance(2_000);
    expect(late.value()).toBeNull();
  });

  it('keeps waiting while pending.json carries our id, up to 30 s', async () => {
    put('pending.json', '{"status":"processing","id":"c1"}');
    const w = settled(waitForResult(opts()));
    await advance(15_000);
    expect(w.value()).toBeUndefined();
    put('result.json', ok);
    await advance(400);
    expect(w.value()?.kind).toBe('result');

    put('pending.json', '{"status":"processing","id":"c1"}');
    const w2 = settled(waitForResult(opts()));
    await advance(WAIT_PENDING_MS - 400);
    expect(w2.value()).toBeUndefined();
    await advance(800);
    expect(w2.value()?.kind).toBe('timeout');
  });

  it('ignores a pending.json of another command', async () => {
    put('pending.json', '{"status":"processing","id":"other"}');
    const w = settled(waitForResult(opts()));
    await advance(WAIT_BASE_MS + 400);
    expect(w.value()?.kind).toBe('timeout');
  });

  it('hands a late result to the background watch and removes the file', async () => {
    const w = settled(waitForResult(opts()));
    await advance(WAIT_BASE_MS + 400);
    const late = settled((w.value() as { kind: 'timeout'; late: Promise<CommandResult | null> }).late);
    await advance(14_000);
    put('result.json', ok);
    await advance(400);
    expect(late.value()).toMatchObject({ id: 'c1', status: 'ok', ticket: 42 });
    expect(exists('result.json')).toBe(false);
  });

  it('leaves a result of another id untouched', async () => {
    put('result.json', '{"status":"ok","ticket":1,"id":"zz"}');
    const w = settled(waitForResult(opts()));
    await advance(WAIT_BASE_MS + 400);
    expect(w.value()?.kind).toBe('timeout');
    expect(exists('result.json')).toBe(true);
  });
});
