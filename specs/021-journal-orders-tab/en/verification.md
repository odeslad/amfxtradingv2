# 021 — Orders tab in the Journal · Verification

| Task | Mechanism | Outcome | Est | Actual |
|---|---|---|---|---|
| 1 | manual (read-through) + local MetaEditor compile | ✅ | 0.5 | 0.25 |
| 2 | manual (script run against a broken copy and the real files) | ✅ | 0.5 | 0.5 |

## Task 1 — `modify` moves a pending order to the received price (ea)

- `HttpBridgeCommands.mq4` `modify` branch: after `OrderSelect`, `isPending = OrderType() >= OP_BUYLIMIT` and `newPrice = (isPending && price > 0) ? price : OrderOpenPrice()`; `OrderModify(ticket, newPrice, sl, tp, 0, clrNONE)`. `price` was already extracted at the top of `ExecuteCommand` (line 65), so a `modify` without it stays at 0 and keeps the open price; market positions (types 0 / 1) keep it whatever the command carries. The OK log line now prints the price. Version 2.22 in `#property version` and the ready banner. `ea/docs/HttpBridgeCommands.md`: `price` field and `modify` row updated.
- Read-through: the branch follows the `ExtractField` / `ResultError` / `ResultOk(-1, id)` conventions of `close` and `modify`; a rejected modification (130 invalid stops, 4107 invalid price, 1 no change) returns through `ResultError` as before. Compiled locally while testing task 2 (Darwinex MT4 MetaEditor): `Result: 0 errors, 0 warnings` for both files, so the 2.22 source is valid before the push; the VPS compiles it again in task 7.
- Est vs Actual: 0.5 vs 0.25 SP.

## Task 2 — `compile-ea.ps1` fails the workflow on a bad compile (ea)

- Rewritten: `-SourceDir` / `-Files` parameters (defaults unchanged: `C:amfxtradingv2ea`, both sources); per file it removes the old log, runs MetaEditor `/compile /log`, prints the error / warning / `Result:` lines of the UTF-16 log, and marks the file **failed** when no `.ex4` exists, the `.ex4` is older than the run, or the log's `Result:` line reports errors; at the end `exit 1` naming the failed files, else `exit 0`. `ea/docs/deploy.md` updated.
- Finding on the way: MetaEditor's exit code is **1 on a successful compile and 0 on a failed one**, so the old script's "exit code ≠ 0 → warning" was inverted and never a signal; the check is the `.ex4` and the log.
- Runs (local Darwinex MT4 MetaEditor): real sources → both `[OK]`, `Result: 0 errors, 0 warnings`, exit 0. Copy with `this is not mql4 ;` appended to `HttpBridgeCommands.mq4` → three `error` lines and `Result: 3 errors` printed, `[FAILED] HttpBridgeCommands.mq4 : no .ex4 produced`, the other file OK, `Compilation failed for: HttpBridgeCommands.mq4`, exit 1.
- Est vs Actual: 0.5 vs 0.5 SP.
