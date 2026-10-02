import { describe, it, expect, vi, afterEach } from 'vitest';
import net from 'net';
import { PipeReader, retryDelay } from './pipe-reader';
import { register, snapshot } from '../store/liveness';

describe('retryDelay', () => {
  it('doubles from 1 s and caps at 30 s', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(retryDelay)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  });
});

// Real timer kept aside: the suite fakes setTimeout to drive the retry schedule.
const realSetTimeout = globalThis.setTimeout;
const settle = (ms = 80): Promise<void> => new Promise(resolve => realSetTimeout(resolve, ms));
const pipeState = (broker: string) => snapshot().get(broker)?.pipe;

// Named pipes exist on Windows only; CI (ubuntu) skips this suite.
describe.skipIf(process.platform !== 'win32')('PipeReader on a real named pipe', () => {
  const cleanup: (() => void)[] = [];
  afterEach(async () => {
    for (const fn of cleanup.splice(0)) fn();
    vi.useRealTimers();
    await settle();
  });

  it('retries a busy pipe with backoff, then listens, connects and times ticks', async () => {
    const broker = `spec010-${process.pid}-${Date.now()}`;
    const pipePath = `\\\\.\\pipe\\mt4tick_${broker}`;
    register(broker, { pipe: true, watcher: false });

    const squatter = net.createServer();
    await new Promise<void>(resolve => squatter.listen(pipePath, resolve));
    cleanup.push(() => squatter.close());

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    cleanup.push(() => errors.mockRestore());

    const reader = new PipeReader(broker);
    cleanup.push(() => reader.stop());
    reader.start();
    await settle();
    expect(pipeState(broker)).toBe('error');
    expect(errors.mock.calls.at(-1)?.[0]).toMatch(/attempt 1, retry in 1s/);

    vi.advanceTimersByTime(1000);
    await settle();
    expect(errors.mock.calls.at(-1)?.[0]).toMatch(/attempt 2, retry in 2s/);

    squatter.close();
    await settle();
    vi.advanceTimersByTime(2000);
    await settle();
    expect(pipeState(broker)).toBe('listening');

    const client = net.connect(pipePath);
    cleanup.push(() => client.destroy());
    await new Promise<void>(resolve => client.once('connect', resolve));
    await settle();
    expect(pipeState(broker)).toBe('connected');
    expect(snapshot().get(broker)?.lastTickAt).toBeNull();

    const ticks = new Promise(resolve => reader.once('ticks', resolve));
    client.write('[{"symbol":"EURUSD","bid":1.1,"ask":1.1002}]\n');
    expect(await ticks).toEqual([{ symbol: 'EURUSD', bid: 1.1, ask: 1.1002 }]);
    expect(snapshot().get(broker)?.lastTickAt).toBeInstanceOf(Date);

    // A second EA socket (re-attach, two charts): closing one keeps the pipe connected.
    const second = net.connect(pipePath);
    cleanup.push(() => second.destroy());
    await new Promise<void>(resolve => second.once('connect', resolve));
    await settle();
    second.end();
    await settle();
    expect(pipeState(broker)).toBe('connected');

    client.end();
    await settle();
    expect(pipeState(broker)).toBe('listening');
  });
});
