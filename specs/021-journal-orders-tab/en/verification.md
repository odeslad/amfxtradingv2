# 021 — Orders tab in the Journal · Verification

| Task | Mechanism | Outcome | Est | Actual |
|---|---|---|---|---|
| 1 | manual (read-through) + local MetaEditor compile | ✅ | 0.5 | 0.25 |
| 2 | manual (script run against a broken copy and the real files) | ✅ | 0.5 | 0.5 |
| 3 | `npm run build` + `npm run lint` + local app against production (user) | ✅ | 1.5 | 1 |
| 4 | `npm run build` + `npm run lint` + local app against production (user) | ✅ | 2 | 1.75 |
| 5 | `npm run build` + `npm run lint` + local app against production (user) | ✅ | 1.5 | 1.25 |
| 6 | both documents agree; backend `npm run build` untouched | ✅ | 0.25 | 0.25 |

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

## Task 4 — Orders tab (frontend)

- `PendingOrders.tsx`: table (Broker, Symbol with ColorBadge, Type, Lots, Price, Distance, SL, TP, Placed, row Edit / Cancel), cards under 768 px, filtering by broker / symbol / order type / side / colour, options reported for the filters panel, group reported through `onGroupChange` only when every listed order shares symbol and type (the Positions rule), empty states "No pending orders" / "No orders match the selected filters", double-click → chart. `OrderCard.tsx` (+ small `.module.css`) reuses `PositionCard.module.css` and `useSwipeActions`: Distance in the P&L slot at 28 px, the kind "· Limit / · Stop" in the label row, details Type / Lots / SL / TP / Broker / Placed. `OrderFiltersPanel.tsx` with `utils/orderFilters.ts` (`OrderFilterValues`, defaults, `hasActiveOrderFilters`), stored as `journal.orderFilters`. `JournalPage`: Orders tab between Positions and History, `?tab=orders` deep link seeding the order filters, Filters button and panel switching by tab, group Edit (placeholder toast until task 5) / Cancel, row Cancel. Cancel confirmation as the mockup: `CancelOrdersPanel.tsx` over `ConfirmPanel.module.css` with `OrderList.tsx` (head "Sell Limit EURUSD" + broker, or the broker per row when the group spans several brokers; one row per order with price, lots, distance), "Cancel all / Cancel order" and "Keep orders / Keep order". `fmtDistance` in `utils/position.ts`.
- `npm run build` and `npm run lint` clean (three react-refresh errors fixed by moving the helpers out of the component files).
- Local app against production: the user checked on 2026-10-23 the Orders tab with the live pending orders of every broker, the distance column, filters, the group Cancel over five Sell Limit EURUSD orders across five brokers (panel adjusted twice on the user's review: mockup layout, then the broker per row when brokers differ). Validated by the user.
- Est vs Actual: 2 vs 1.75 SP.

## Task 5 — Edit panel for one order or a group (frontend)

- `EditOrderPanel.tsx` (+ `.module.css` for the stats row and the error box) over `BulkEditPanel.module.css`: header "Edit order · ticket" / "Edit N orders", the `OrderList` head and rows, Price, then SL / TP (empty = keep), then a row with the current fill price (ask for buys, bid for sells) and the **new distance** recomputed from the typed price, the side-of-market check (buy limit below the ask, sell limit above the bid, stops the other way) shown as a red box that disables the button, and "Modify order" / "Modify N". `lib/commands.ts`: `modifyCommand(p, sl, tp, price?)` adds `price` only when given, so position edits are unchanged. `JournalPage`: row Edit and group Edit open the panel; the edit and cancel panels keep ticket keys and resolve the live orders on every render, so their prices, SL / TP and distances follow the WebSocket while open (the first version held a copy and froze). Fixed on the way: `orderDistancePips` had the limit / stop test on types 2 and 5 instead of 2 and 3, which inverted the sign of sell limits and sell stops.
- `npm run build` and `npm run lint` clean.
- Local app against production, checked by the user on 2026-10-23: the panel follows the live quote (+100.3 → +99.2 while open), the new distance moves with the typed price, a sell limit typed below the bid shows "A sell limit must sit above the bid (1.12008)" with the button disabled, the price field no longer stretches the form (a `flex: 1` inherited from the positions panel). SL edit sent and confirmed; moving the price needs the EA 2.22 that ships in task 7 (the 2.21 keeps the open price and MT4 answers error 1, no change), so that check is part of the production validation. Validated by the user.
- Est vs Actual: 1.5 vs 1.25 SP.

## Task 6 — Docs: `modify` with an optional `price` (backend)

- `backend/docs/architecture.md` (commands section) and `.claude/CLAUDE.md` (Comandos) now state that `modify` takes `ticket`, `sl`, `tp` and an optional `price` that the backend forwards and the EA 2.22+ applies to pending orders only; a market position keeps its open price. No code change: `routes/commands.ts` already validated and forwarded `price` on `modify`.
- Both documents say the same; backend `npm run build` untouched (no source change).
- Est vs Actual: 0.25 vs 0.25 SP.
