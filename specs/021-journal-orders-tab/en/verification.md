# 021 — Orders tab in the Journal · Verification

| Task | Mechanism | Outcome | Est | Actual |
|---|---|---|---|---|
| 1 | manual (read-through) + local MetaEditor compile | ✅ | 0.5 | 0.25 |
| 2 | manual (script run against a broken copy and the real files) | ✅ | 0.5 | 0.5 |
| 3 | `npm run build` + `npm run lint` + local app against production (user) | ✅ | 1.5 | 1 |

## Task 1 — `modify` moves a pending order to the received price (ea)

- `HttpBridgeCommands.mq4` `modify` branch: after `OrderSelect`, `isPending = OrderType() >= OP_BUYLIMIT` and `newPrice = (isPending && price > 0) ? price : OrderOpenPrice()`; `OrderModify(ticket, newPrice, sl, tp, 0, clrNONE)`. `price` was already extracted at the top of `ExecuteCommand` (line 65), so a `modify` without it stays at 0 and keeps the open price; market positions (types 0 / 1) keep it whatever the command carries. The OK log line now prints the price. Version 2.22 in `#property version` and the ready banner. `ea/docs/HttpBridgeCommands.md`: `price` field and `modify` row updated.
- Read-through: the branch follows the `ExtractField` / `ResultError` / `ResultOk(-1, id)` conventions of `close` and `modify`; a rejected modification (130 invalid stops, 4107 invalid price, 1 no change) returns through `ResultError` as before. Compiled locally while testing task 2 (Darwinex MT4 MetaEditor): `Result: 0 errors, 0 warnings` for both files, so the 2.22 source is valid before the push; the VPS compiles it again in task 7.
- Est vs Actual: 0.5 vs 0.25 SP.

## Task 2 — `compile-ea.ps1` fails the workflow on a bad compile (ea)

- Rewritten: `-SourceDir` / `-Files` parameters (defaults unchanged: `C:amfxtradingv2ea`, both sources); per file it removes the old log, runs MetaEditor `/compile /log`, prints the error / warning / `Result:` lines of the UTF-16 log, and marks the file **failed** when no `.ex4` exists, the `.ex4` is older than the run, or the log's `Result:` line reports errors; at the end `exit 1` naming the failed files, else `exit 0`. `ea/docs/deploy.md` updated.
- Finding on the way: MetaEditor's exit code is **1 on a successful compile and 0 on a failed one**, so the old script's "exit code ≠ 0 → warning" was inverted and never a signal; the check is the `.ex4` and the log.
- Runs (local Darwinex MT4 MetaEditor): real sources → both `[OK]`, `Result: 0 errors, 0 warnings`, exit 0. Copy with `this is not mql4 ;` appended to `HttpBridgeCommands.mq4` → three `error` lines and `Result: 3 errors` printed, `[FAILED] HttpBridgeCommands.mq4 : no .ex4 produced`, the other file OK, `Compilation failed for: HttpBridgeCommands.mq4`, exit 1.
- Est vs Actual: 0.5 vs 0.5 SP.

## Task 3 — Shared live feed, swipe hook, pip helpers; Positions without the pending section (frontend)

- `features/journal/useLivePositions.ts`: the REST snapshot of `/positions/live`, the WebSocket `positions` merge (brokers refreshed by the WS are not overwritten by a late snapshot) and the colour map with `setColor`, moved out of `OpenPositions` and called once in `JournalPage`, which passes `positions.filter(!isPending)` to Positions. `utils/useSwipeActions.ts`: the card gestures (swipe left / right, tap, double tap) from `PositionCard`, which now uses the hook. `utils/position.ts`: `pipSize(symbol)` (also used by `calcPnl`) and `orderDistancePips(p)` for task 4. `OpenPositions` takes `positions` / `colors` / `onColorChange` as props and loses the fetch, the WS, the colour state, the "Pending Orders" table and cards and their `.pending*` CSS; its confirm panel is "Close position?" only. `vite.config.ts`: `changeOrigin: true` on the dev proxy so `DEV_API_TARGET` can be the production API behind Cloudflare (it answered 530 to the local Host header).
- `npm run build` and `npm run lint` clean.
- Local app: Vite 5174 proxying `https://api-v2.amfxtrading.com` (the `.amfxtrading.com` cookie and origin are accepted), signed in; the user checked Positions on 2026-10-23: Accounts and the open positions of every broker with live P&L, colour badges, no pending section; a command sent from the page returned its `command_result` toast. Confirmed by the user from screenshots.
- Est vs Actual: 1.5 vs 1 SP.
