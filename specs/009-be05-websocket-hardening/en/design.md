# 009 · BE-05 — WebSocket hardening · Design

## Approach

Rewrite `backend/src/ws/ws.ts` around `WebSocketServer({ noServer: true })` and an explicit `server.on('upgrade')` handler. The upgrade handler is the single gate: it checks the path, the `Origin` and the JWT, answers a plain HTTP error on the raw socket when any fails, and only then calls `handleUpgrade`. Everything that is pure (origin matching, cookie parsing, buffer policy) lives in a small module without `ws`/`http` imports so it can be unit-tested; `ws.ts` keeps the wiring. The public surface of `createWss` (`broadcastTicks`, `broadcastPositions`, …) does not change, so `index.ts` only gains the shutdown call.

No new dependencies: `ws` 8 already ships `noServer`, `handleUpgrade`, `ping`/`pong` and `bufferedAmount`.

## Changes per layer

### backend

**1. `src/ws/policy.ts` (new, pure)**

```ts
export const ALLOWED_ORIGINS = [/\.amfxtrading\.com(:\d+)?$/];   // moved out of app.ts, imported by both
export const isAllowedOrigin = (origin: string | undefined): boolean
export const tokenFromCookie = (cookieHeader: string | undefined): string | null
export const HEARTBEAT_MS = 30_000;
export const SKIP_ABOVE_BYTES = 1 << 20;   // 1 MB
export const KILL_ABOVE_BYTES = 8 << 20;   // 8 MB
export type SendDecision = 'send' | 'skip' | 'terminate';
export const sendDecision = (bufferedAmount: number): SendDecision
```

- `isAllowedOrigin(undefined)` → `false` for the WS (a browser always sends `Origin` on a WebSocket handshake; a non-browser client without one has no cookie anyway). This differs from the CORS middleware, which keeps allowing requests without `Origin` (curl, the deploy health check).
- `app.ts` imports `ALLOWED_ORIGINS` from `ws/policy.ts` instead of its own constant — one list.

**2. `src/ws/ws.ts` (rewrite)**

```ts
interface Client extends WebSocket { userId: number; isAlive: boolean }

export function createWss(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    if (url(req).pathname !== '/ws') return;                    // other upgrades are nobody's: destroy
    if (!isAllowedOrigin(req.headers.origin)) return reject(socket, 403, 'Forbidden');
    const userId = verifyToken(tokenFromCookie(req.headers.cookie));
    if (userId === null) return reject(socket, 401, 'Unauthorized');
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req, userId));
  });

  wss.on('connection', (ws: Client, _req, userId: number) => {
    ws.userId = userId; ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    …logs as today…
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients as Set<Client>) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false; ws.ping();
    }
  }, HEARTBEAT_MS);

  function send(ws: Client, message: string) {
    if (ws.readyState !== WebSocket.OPEN) return;
    switch (sendDecision(ws.bufferedAmount)) {
      case 'terminate': ws.terminate(); return;
      case 'skip': return;
      case 'send': ws.send(message);
    }
  }
  const broadcast = (type, payload) => for every client → send
  const sendToUser = (userId, type, payload) => for clients with ws.userId === userId → send

  return {
    …same broadcast methods…,
    broadcastAlert: (userId, …)    => sendToUser(userId, 'alert', {...}),
    broadcastEmaAlert: (userId, …) => sendToUser(userId, 'ema_alert', {...}),
    close() { clearInterval(heartbeat); for (ws of wss.clients) ws.terminate(); wss.close(); },
  };
}
```

- `reject(socket, status, text)` writes `HTTP/1.1 <status> <text>\r\nConnection: close\r\n\r\n` and `socket.destroy()`. An upgrade for a path other than `/ws` is destroyed without a status (today `ws` with `path` does the same: 400).
- `verifyToken` reuses `jwt.verify(token, config.jwtSecret)` and reads `sub` like `requireAuth.ts`; returns `null` on any failure.
- `handleUpgrade`'s callback emits `connection` with `userId` as a third argument; the `connection` handler is the only place that writes `ws.userId`, so no socket exists without one.
- The `alert` / `ema_alert` payloads keep the `userId` field (the frontend still compares it).
- Terminate on `!isAlive` uses `terminate()` (not `close()`): a dead peer would never complete the close handshake.
- The 1 MB skip applies per message, so a slow but alive client loses ticks (fine: the next batch carries fresh prices) but keeps the connection; only a client that never drains reaches 8 MB.

**3. `src/index.ts`**

`SIGTERM`: `wss.close()` first, then pipes/watchers, `server.close()`, and `db.$disconnect()` last (the audit noted the DB was disconnected before the HTTP server; fix the order while touching the block). The behaviour on Windows/pm2 is unchanged (the path rarely runs) but the heartbeat timer must not keep a graceful shutdown alive.

**4. Tests (`vitest`, from spec 008)**

- `ws/policy.test.ts`: origin allow-list (prod host, `local.amfxtrading.com:5174`, `https://evil.com`, `undefined`), `tokenFromCookie` (absent, first, middle, with other cookies, URL-encoded value untouched), `sendDecision` thresholds.
- `ws/ws.test.ts` (integration, real sockets on an ephemeral port with `ws` as client): 403 on bad origin, 401 without cookie, 101 with a signed token; per-user alert delivery (two clients, two users); heartbeat with fake timers — a client whose `pong` handler is removed is terminated after two intervals while the healthy one stays. `config` needs `JWT_SECRET`/`DATABASE_URL`/`BROKERS_FILE`: the test sets `process.env` before importing and points `BROKERS_FILE` at a fixture JSON in the test folder (`[{ "name": "test", "bridgePath": "." }]`) — not the real `brokers.json`.

## Data flow

Unchanged: EA → pipe → `index.ts` → `wss.broadcast*` → clients. Only the client set is now filtered (origin + JWT at the door, `userId` for alerts) and pruned (heartbeat, backpressure).

## Files to touch

| File | Change |
|---|---|
| `backend/src/ws/policy.ts` | new: origin list, cookie parsing, heartbeat/backpressure constants and `sendDecision` |
| `backend/src/ws/policy.test.ts` | new |
| `backend/src/ws/ws.ts` | rewrite: `noServer` + `upgrade` gate, `userId` per socket, heartbeat, backpressure, `sendToUser`, `close()` |
| `backend/src/ws/ws.test.ts` | new: integration tests |
| `backend/src/ws/fixtures/brokers.json` | new: test fixture for `config` |
| `backend/src/app.ts` | import `ALLOWED_ORIGINS` from `ws/policy` |
| `backend/src/index.ts` | shutdown order with `wss.close()` |

## Risks

- **Origin in local dev**: the Vite proxy forwards the browser's `Origin` (`https://local.amfxtrading.com:5174`), which matches the regex; verified in the production-validation task on the local stack too. If a future dev host is not under `amfxtrading.com`, the list must grow — explicit by design.
- **Cloudflare / nginx**: both forward `Origin` and `Cookie` unchanged for WebSocket upgrades (the cookie is already how the WS authenticates today); `403`/`401` answers before the upgrade are plain HTTP and pass through.
- **Heartbeat false positives**: a tab in the background still answers pings at the protocol level (the browser does it, not JS), so only truly dead connections are terminated. The 30 s interval means a dead peer lives at most ~60 s.
- **Frontend after a rejected upgrade**: the browser fires `onclose`, the client retries every 3 s — same loop as today's 1008 close; out of scope.
- `wss.emit('connection', …, userId)` relies on the extra argument reaching the listener; typed through a local `Client` interface and covered by the integration test.
