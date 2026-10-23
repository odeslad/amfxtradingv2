# 021 — Orders tab in the Journal · Verification

| Task | Mechanism | Outcome | Est | Actual |
|---|---|---|---|---|
| 1 | manual (read-through; compiled by the pipeline in task 7) | 🕐 | 0.5 | 0.25 |

## Task 1 — `modify` moves a pending order to the received price (ea)

- `HttpBridgeCommands.mq4` `modify` branch: after `OrderSelect`, `isPending = OrderType() >= OP_BUYLIMIT` and `newPrice = (isPending && price > 0) ? price : OrderOpenPrice()`; `OrderModify(ticket, newPrice, sl, tp, 0, clrNONE)`. `price` was already extracted at the top of `ExecuteCommand` (line 65), so a `modify` without it stays at 0 and keeps the open price; market positions (types 0 / 1) keep it whatever the command carries. The OK log line now prints the price. Version 2.22 in `#property version` and the ready banner. `ea/docs/HttpBridgeCommands.md`: `price` field and `modify` row updated.
- Read-through: the branch follows the `ExtractField` / `ResultError` / `ResultOk(-1, id)` conventions of `close` and `modify`; a rejected modification (130 invalid stops, 4107 invalid price, 1 no change) returns through `ResultError` as before. Compilation happens on the VPS in the task 7 push (MetaEditor through `compile-ea.ps1`); 🕐 until that run is green.
- Est vs Actual: 0.5 vs 0.25 SP.
