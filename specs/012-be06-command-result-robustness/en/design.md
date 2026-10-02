# 012 · BE-06 — Command result robustness · Design

## Approach

Move the file side of the command path out of `routes/commands.ts` into `bridge/command-io.ts`: atomic write, result parsing, error wording, stale-result cleanup and the wait itself. Everything there takes paths and a poll interval, so it is tested against a temporary directory with vitest fake timers — no EA, no MT4. The route keeps the HTTP shape, the per-broker queue and the WS broadcasts; it just calls the new module. The wait returns either a result or a timeout *plus a promise for a late result*, so the queue moves on at the timeout while the background watch keeps going.

No new dependencies.

## Changes per layer

### backend

**1. `src/bridge/command-io.ts` (new)**

```ts
export interface CommandResult { id: string; status: string; ticket?: number; code?: number; message?: string }

export const WAIT_BASE_MS = 10_000;      // as today
export const WAIT_PENDING_MS = 30_000;   // when pending.json carries our id
export const WAIT_LATE_MS = 60_000;      // background watch after the timeout
export const POLL_MS = 300;

export function writeCommand(bridgePath: string, command: object): void
// writeFileSync(command.tmp) → renameSync(command.tmp → command.json). Windows: renameSync
// over an existing command.json replaces it (the EA deletes it after reading anyway).

export function readResult(resultPath: string): CommandResult | null
// null when the file is missing, unreadable or not yet complete JSON (EA mid-write).

export function errorText(result: CommandResult): string | undefined
// 'ok' → undefined; message → `EA error: ${message}` + ` (code ${code})` if code; else `EA error (code N)` / 'EA error'.

export function discardStaleResult(resultPath: string, log: (msg: string) => void): void
// result.json exists with any id → unlink + log once (`discarding stale result id=…`).

export type WaitOutcome =
  | { kind: 'result'; result: CommandResult }
  | { kind: 'timeout'; late: Promise<CommandResult | null> };

export function waitForResult(opts: { resultPath: string; pendingPath: string; id: string }): Promise<WaitOutcome>
```

`waitForResult` polls every `POLL_MS`:
- result with our `id` → unlink, resolve `result`.
- elapsed ≥ `WAIT_BASE_MS` and `pending.json` does **not** carry our `id` → timeout.
- elapsed ≥ `WAIT_PENDING_MS` → timeout regardless.
- on timeout: resolve `{ kind: 'timeout', late }` where `late` keeps polling for `WAIT_LATE_MS` more and resolves with the result (unlinked) or `null`. Both phases share one interval that is cleared at the end; a result with another id is left alone (it belongs to a later command's `discardStaleResult`).

**2. `src/routes/commands.ts`**

```ts
enqueue(broker, async () => {
  discardStaleResult(resultPath, msg => console.warn(`[CMD:${broker}] ${msg}`));
  try { writeCommand(brokerConfig.bridgePath, command); } catch … (as today)
  const outcome = await waitForResult({ resultPath, pendingPath, id });
  if (outcome.kind === 'result') { broadcastResult(outcome.result); return; }
  broadcaster?.(id, 'timeout', undefined, 'No response from EA');
  console.warn(`[CMD:${broker}] timeout waiting for result id=${id}`);
  void outcome.late.then(result => {
    if (!result) return;
    console.log(`[CMD:${broker}] late result id=${id} status=${result.status} ticket=${result.ticket ?? '-'}`);
    broadcaster?.(id, result.status, result.ticket, errorText(result), true);
  });
});
```

`Broadcaster` gains an optional fifth argument `late?: boolean`; `ws.ts` `broadcastCommandResult` adds `late: true` to the payload only when set (the message shape is otherwise unchanged). `index.ts` wiring passes it through.

**3. Tests — `src/bridge/command-io.test.ts`** (temp dir per test via `fs.mkdtempSync`, `vi.useFakeTimers` for the poll)

- `writeCommand`: `command.json` exists with the JSON, no `command.tmp` left; overwrites an existing `command.json`.
- `readResult`: missing → null; partial JSON → null; full → parsed.
- `errorText`: ok → undefined; `{status:'error',code:130}` → `EA error (code 130)`; `{message:'ticket not found'}` → `EA error: ticket not found`; both → `EA error: ticket not found (code 130)`; neither → `EA error`.
- `discardStaleResult`: removes and logs once; no file → no log.
- `waitForResult`: result at 2 s → `result`, file unlinked; nothing at 10 s → timeout, `late` resolves null at 70 s; `pending.json` with our id → still waiting at 15 s, result at 20 s → `result`; `pending.json` with our id but no result → timeout at 30 s; result at 25 s after a timeout at 10 s → `late` resolves with it and the file is unlinked; `result.json` with another id → ignored (timeout), file untouched.

**4. `docs/architecture.md` / `ea/docs/HttpBridgeCommands.md`**: note the extended wait and the `late` flag in the WS message (backend doc); the EA doc already describes `pending.json` — add a line that the backend now honours it.

## Data flow

Unchanged except timing: `POST /commands` → 202 → queue → `command.tmp`→`command.json` → EA → (`pending.json`) → `result.json` → `command_result` (immediate, or `timeout` then possibly a second `command_result` with `late: true`).

## Files to touch

| File | Change |
|---|---|
| `backend/src/bridge/command-io.ts` | new |
| `backend/src/bridge/command-io.test.ts` | new |
| `backend/src/routes/commands.ts` | use the module; late-result handling; `waitForResult` removed from here |
| `backend/src/ws/ws.ts` | `broadcastCommandResult(..., late?)` |
| `backend/src/index.ts` | pass `late` through the broadcaster |
| `backend/docs/architecture.md`, `ea/docs/HttpBridgeCommands.md` | wait/late notes (docs only; the EA doc change is a `docs(ea)` commit) |

## Risks

- **Windows rename over an existing file**: `fs.renameSync` replaces the target on Windows (MoveFileEx semantics in libuv). If the EA has `command.json` open at that instant the rename fails with `EPERM`; the write is inside the existing try/catch and reports `Failed to write command` — the same failure mode as today's `writeFileSync` hitting an open file, not a new one.
- **Late `ok` after the user re-sent the order**: the user may have repeated the order during the timeout window; the late toast tells them two orders executed. That is exactly the information they lacked; the 30 s pending-aware wait makes the window much smaller.
- The background watch never blocks the queue; at most one 300 ms interval per late watch, bounded to 60 s.
- Production validation needs a real slow execution: the user will send a `modify` with an invalid ticket (immediate `EA error: ticket not found`) and a normal order; the late path is proven by the unit tests and, on production, by stopping the EA for ~15 s before sending a command (`pending.json` absent → timeout at 10 s, EA restarted → result arrives late → toast "Order executed").
