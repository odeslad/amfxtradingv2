# 011 — Accounts row liveness · Design

## Approach

`routes/balances.ts` `daily-pnl` skips brokers whose liveness entry says the pipe is not connected. The check is a small pure helper in `store/liveness.ts`, `isPipeLive(state)`, true for `connected` and `disabled`, so it is unit-tested with the rest of the store. No schema, WS or frontend change.

## Changes

- `store/liveness.ts`: `isPipeLive(pipe)` → `pipe === 'connected' || pipe === 'disabled'`; `pipeStateOf(broker)` → the registered state or `null` (an unregistered broker is treated as live, so any unexpected path stays harmless).
- `routes/balances.ts`: in the `daily-pnl` loop, skip the broker when `!isPipeLive(pipeStateOf(broker) ?? 'connected')`.
- `store/liveness.test.ts`: cases for `isPipeLive` and `pipeStateOf`.

## Files to touch

| File | Change |
|---|---|
| `backend/src/store/liveness.ts` | `isPipeLive`, `pipeStateOf` |
| `backend/src/store/liveness.test.ts` | tests |
| `backend/src/routes/balances.ts` | skip non-live brokers in `daily-pnl` |

## Risks

- A broker whose pipe is in `error` (retrying) is also omitted — correct: no EA is feeding it.
- None for connected brokers: the loop body is unchanged.
