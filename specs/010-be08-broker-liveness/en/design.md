# 010 · BE-08 — Broker liveness · Design

## Approach

One in-memory store, `store/liveness.ts`, holds the per-broker state (`pipe`, `lastTickAt`, `lastSyncAt`) and derives the `/health` body with a pure function. `PipeReader` and `FileWatcher` report into it; `index.ts` registers each configured broker at startup (so a broker shows up even before its first message, and as `disabled` when the feature flag is off). The pipe retry lives inside `PipeReader` as a `listen` loop with exponential backoff. The HTTP route only formats the store — no I/O, so it stays as fast as today for the deploy and startup scripts.

No new dependencies.

## Changes per layer

### backend

**1. `src/store/liveness.ts` (new)**

```ts
export type PipeState = 'listening' | 'connected' | 'error' | 'disabled';
interface BrokerLiveness { pipe: PipeState; lastTickAt: Date | null; lastSyncAt: Date | null; watcher: boolean }

register(broker, { pipe: boolean, watcher: boolean })   // from index.ts, state = disabled when pipe is off
setPipeState(broker, state)
touchTick(broker, at = new Date())
touchSync(broker, at = new Date())
snapshot(): Map<string, BrokerLiveness>                 // copy, for tests

export const STALE_TICK_MS = 5 * 60_000;
export function healthReport(now: Date, startedAt: Date, state: Map<...>): HealthReport
```

`healthReport` is pure: for each broker `name, pipe, lastTickAt (ISO|null), lastSyncAt (ISO|null), tickAgeS, syncAgeS`; `status = 'degraded'` when any broker with `pipe !== 'disabled'` is not `connected` or has `tickAgeS === null || tickAgeS > 300`; otherwise `'ok'`. `uptimeS = (now − startedAt) / 1000` rounded. The watcher being disabled only yields `lastSyncAt: null`; it never affects `status` (a stale sync is not a liveness criterion in this spec — the EA writes those files on its own schedule).

**2. `src/bridge/pipe-reader.ts`**

- `start()` becomes `listen(attempt = 0)`: creates the server (once) and calls `server.listen(pipePath)`. On the `'error'` event of the *listen* phase: `setPipeState(broker, 'error')`, log `[PIPE-READER:<broker>] listen failed (attempt n, retry in Ns): <message>`, `setTimeout(() => listen(attempt + 1), min(1000 · 2^attempt, 30 000))`. On `'listening'`: `setPipeState('listening')`, attempt counter reset.
- Connection handler: `setPipeState('connected')` on connect, `setPipeState('listening')` on socket close. Every parsed message (ticks, positions, account) calls `touchTick(broker)`.
- `stop()` clears the retry timer and closes the server.
- `net.Server` emits `'error'` both for listen failures and later runtime errors; after `'listening'` has fired the retry path is still correct (close + listen again), so one handler covers both.

**3. `src/bridge/file-watcher.ts`**

- `poll()` → in `finally`, `touchSync(broker)` (the poll ran; per-step failures are already logged by `runStep`).
- `readCandles()` directory error: `console.error('[FILE-WATCHER: <broker>] cannot list <path> | <message>')`, throttled with a `lastListErrorAt` field: emitted when `now − lastListErrorAt ≥ 60 000`.

**4. `src/index.ts`**

- At `startBroker`: `register(brokerName, { pipe: features.pipe, watcher: features.watcher })`.
- `syncColors(brokerName, tickets).catch(err => console.error('[COLORS:' + brokerName + ']', message(err)))`.
- `startedAt = new Date()` passed to the health route via `app.locals` is avoided: `app.ts` keeps its own `const startedAt = new Date()` at module load (the module loads once at process start; the difference to `main()` is milliseconds).

**5. `src/app.ts`**

```ts
app.get('/health', (_req, res) => res.json(healthReport(new Date(), startedAt, snapshot())));
```

Always `200`. Response example:

```json
{ "status": "degraded", "uptimeS": 5121,
  "brokers": [
    { "name": "darwinex", "pipe": "connected", "lastTickAt": "2026-10-02T08:14:03.120Z", "lastSyncAt": "2026-10-02T08:13:50.002Z", "tickAgeS": 1, "syncAgeS": 14 },
    { "name": "solidary isa", "pipe": "listening", "lastTickAt": "2026-10-02T06:00:11.000Z", "lastSyncAt": "…", "tickAgeS": 8032, "syncAgeS": 14 } ] }
```

**6. Tests (vitest)**

- `store/liveness.test.ts`: `healthReport` pure cases — all connected and fresh → `ok`; one `listening` → `degraded`; one connected but tick older than 5 min → `degraded`; disabled pipe → ignored, `ok`; never-ticked connected broker → `degraded` with `tickAgeS: null`; ISO/age formatting; `uptimeS`.
- `bridge/pipe-reader.test.ts` (integration on a real named pipe, Windows only — `describe.skipIf(process.platform !== 'win32')`): occupy `\\.\pipe\mt4tick_<random>` with a plain `net.Server`, start `PipeReader`, with fake timers check `pipe === 'error'` and the retry schedule 1 s → 2 s; release the pipe → next retry → `listening`; connect a client and write one tick line → `connected` + `lastTickAt` set; client ends → `listening`. CI runs on `ubuntu-latest`, so the suite is skipped there; it runs on the developer's Windows machine. Unix domain sockets could stand in on Linux but the path semantics differ; not worth it for this spec.

## Data flow

EA → pipe → `PipeReader` → `touchTick`/`setPipeState` → `liveness` store ← `touchSync` ← `FileWatcher`. `GET /health` → `healthReport(snapshot)`. No DB, no WS.

## Files to touch

| File | Change |
|---|---|
| `backend/src/store/liveness.ts` | new: per-broker state + pure `healthReport` |
| `backend/src/store/liveness.test.ts` | new |
| `backend/src/bridge/pipe-reader.ts` | listen retry with backoff, state + tick reporting, `stop()` clears the timer |
| `backend/src/bridge/pipe-reader.test.ts` | new (Windows-only integration) |
| `backend/src/bridge/file-watcher.ts` | `touchSync` per poll, throttled directory error with message |
| `backend/src/index.ts` | `register` per broker, `syncColors` error logged |
| `backend/src/app.ts` | `/health` body from `healthReport` |
| `backend/docs/architecture.md` | `GET /health` section updated (the doc already describes the route) |

## Risks

- **Deploy/startup scripts**: they only test for HTTP 200 (`Wait-Health`, `Test-BackendHealth`); the body change is invisible to them. Verified in the production task by watching the deploy's own health wait.
- **Weekend**: forex sends no ticks from Friday night to Sunday night, so `status` will read `degraded` with large `tickAgeS` on every broker. Accepted in the requirements; the field values make the cause obvious. A future watchdog must look at `pipe` rather than `status` to decide on a restart.
- **Retry on a pipe held by a zombie process**: the retry loop logs every attempt (capped at one per 30 s); it never kills the other process — `deploy.ps1` already handles orphans at deploy time.
- `net.Server` `'error'` after `'listening'` (rare on named pipes) now triggers a re-listen; the previous behaviour was to log and stay dead.
