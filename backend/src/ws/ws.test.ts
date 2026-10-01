import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import { WebSocket } from 'ws';
import { HEARTBEAT_MS } from './policy';
import { createWss } from './ws';

// `config` reads these at import time; hoisted so they are set before `./ws` loads.
const { SECRET } = vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.DATABASE_URL = 'postgresql://unused';
  process.env.BROKERS_FILE = 'src/ws/fixtures/brokers.fixture.json';   // vitest runs from backend/
  return { SECRET: 'test-secret' };
});

const ORIGIN = 'https://app-v2.amfxtrading.com';
const tokenFor = (userId: number): string => jwt.sign({ sub: userId }, SECRET);

let server: http.Server;
let wss: ReturnType<typeof createWss>;
let url: string;
const open: WebSocket[] = [];

beforeAll(async () => {
  server = http.createServer();
  wss = createWss(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/ws`;
});

afterAll(async () => {
  wss.close();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

afterEach(() => {
  for (const ws of open.splice(0)) ws.terminate();
  vi.useRealTimers();
});

// Resolves with the HTTP status of a rejected handshake, or 101 once open.
function handshake(headers: Record<string, string>, target = url): Promise<number> {
  const ws = new WebSocket(target, { headers });
  open.push(ws);
  return new Promise(resolve => {
    ws.once('open', () => resolve(101));
    ws.once('unexpected-response', (_req, res) => { resolve(res.statusCode ?? 0); ws.terminate(); });
    ws.once('error', () => resolve(0));
  });
}

async function connectAs(userId: number): Promise<WebSocket> {
  const ws = new WebSocket(url, { headers: { origin: ORIGIN, cookie: `token=${tokenFor(userId)}` } });
  open.push(ws);
  await new Promise<void>((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  return ws;
}

const nextMessage = (ws: WebSocket): Promise<unknown> =>
  new Promise(resolve => ws.once('message', data => resolve(JSON.parse(data.toString()))));

const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 50));

describe('upgrade gate', () => {
  it('rejects an unlisted origin with 403 before any socket exists', async () => {
    expect(await handshake({ origin: 'https://evil.com', cookie: `token=${tokenFor(1)}` })).toBe(403);
    expect(wss.clientCount()).toBe(0);
  });

  it('rejects a missing origin with 403', async () => {
    expect(await handshake({ cookie: `token=${tokenFor(1)}` })).toBe(403);
  });

  it('rejects a missing or invalid token with 401', async () => {
    expect(await handshake({ origin: ORIGIN })).toBe(401);
    expect(await handshake({ origin: ORIGIN, cookie: 'token=not-a-jwt' })).toBe(401);
    expect(await handshake({ origin: ORIGIN, cookie: `token=${jwt.sign({ sub: 1 }, 'other-secret')}` })).toBe(401);
    expect(wss.clientCount()).toBe(0);
  });

  it('accepts a valid origin and token', async () => {
    expect(await handshake({ origin: ORIGIN, cookie: `a=1; token=${tokenFor(7)}` })).toBe(101);
    expect(wss.clientCount()).toBe(1);
  });

  it('drops upgrades for other paths', async () => {
    expect(await handshake({ origin: ORIGIN, cookie: `token=${tokenFor(1)}` }, url.replace('/ws', '/other'))).toBe(0);
  });
});

describe('delivery', () => {
  it('broadcasts ticks to every client but alerts only to their owner', async () => {
    const [a, b] = await Promise.all([connectAs(1), connectAs(2)]);
    const tickA = nextMessage(a);
    const tickB = nextMessage(b);
    wss.broadcastTicks('test', [{ symbol: 'EURUSD', bid: 1.1 }]);
    expect(await tickA).toMatchObject({ type: 'ticks', broker: 'test' });
    expect(await tickB).toMatchObject({ type: 'ticks', broker: 'test' });

    const alertA = nextMessage(a);
    const received: unknown[] = [];
    b.on('message', data => received.push(JSON.parse(data.toString())));
    wss.broadcastAlert(1, 'test', 'EURUSD', 1.1, 'above');
    wss.broadcastEmaAlert(1, 'test', 'EURUSD', 'H1', 'buy');
    expect(await alertA).toEqual({ type: 'alert', userId: 1, broker: 'test', symbol: 'EURUSD', price: 1.1, direction: 'above' });
    await settle();
    expect(received).toEqual([]);
  });
});

describe('heartbeat', () => {
  it('terminates a client that stops answering pings and keeps the healthy one', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    server.close();
    wss.close();
    server = http.createServer();
    wss = createWss(server);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/ws`;

    const healthy = await connectAs(1);
    const dead = await connectAs(2);
    // `ws` answers pings automatically; a frozen peer never reads them.
    dead.pause();

    vi.advanceTimersByTime(HEARTBEAT_MS);
    await settle();
    expect(wss.clientCount()).toBe(2);
    vi.advanceTimersByTime(HEARTBEAT_MS);
    await settle();
    expect(wss.clientCount()).toBe(1);
    expect(healthy.readyState).toBe(WebSocket.OPEN);
  });
});
