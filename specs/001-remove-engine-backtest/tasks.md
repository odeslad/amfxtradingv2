# 001 — Remove trading engine and backtest · Tasks

Each task is one conventional commit. The project must build and run after every task. Backend tasks (1–4) and frontend tasks (5–8) never share a commit. Task 9 is the only one that touches the database and is pushed only after explicit user confirmation.

## Backend

- [x] 1. Move shared modules to `backend/src/indicators/` (`ema.ts`, `ema-cross.ts`, `pip-size.ts`, `timeframe.ts`) and update the imports in `alerts/ema-alert-evaluator.ts`, `services/scanner.ts`, `routes/candles.ts`, `routes/setup-levels.ts` and the temporary ones in `services/backtest.ts` and `engine/evaluators/*`. No logic changes. `npm run build` passes. — Design § Backend — move. `refactor(backend): move shared indicators out of engine` [SP: 2]

- [x] 2. Remove the live engine: delete `engine/engine.ts`, `engine/candle-tracker.ts`, `engine/strategy-evaluator.ts`, `engine/order-executor.ts`; remove the `Engine` import, construction and `processTicks` call from `index.ts`; remove the `engine` flag from `config.ts`. `npm run build` passes. — Design § Backend — delete / modify. `refactor(backend): remove trading engine` [SP: 1]

- [ ] 3. Remove the backtest: delete `services/backtest.ts`, `routes/strategies.ts`, `engine/evaluators/setup-evaluator.ts`, `engine/evaluators/entry-evaluator.ts`, `engine/evaluators/entry/`; remove the `strategiesRouter` import and mount from `app.ts`; delete the now-empty `backend/src/engine/` directory. Grep confirms no reference to `engine/`, `db.strategy` or `db.backtest` remains. `npm run build` passes. — Design § Backend — delete / modify. `refactor(backend): remove backtest service and strategies route` [SP: 2]

- [ ] 4. Verify on the VPS after the backend deploy: `/health` responds, `/strategies` responds 404, scanner page loads, an EMA-cross alert can be created, `/setup-levels` returns levels from the New Trade panel, startup log shows no `engine` in the disabled-features line. No commit; record the result in Outcome. — Requirements AC 1, 2, 5. [SP: 1]

## Frontend

- [ ] 5. Remove the backtest overlay from `LightweightChart.tsx` (Group A): the five `BacktestOverlay*` types, the `backtestOverlay` prop and ref, `drawBacktestOverlay` and its call site, the per-frame scale watcher, the dependency entries and the stale comment. Follow the chart safety protocol: deletion only, `npm run build`, then run the full manual checklist on the Chart page before committing. — Design § LightweightChart excision, Group A; § Chart safety protocol. `refactor(frontend): drop backtest overlay from chart component` [SP: 3]

- [ ] 6. (Optional, revert-alone) Remove the backtest-only window props from `LightweightChart.tsx` (Group B): `focusRange`, `candlesKind`, `emaData`, `onLoadNewer`, `hasNewer` and the branches that only they reach (backend-EMA branch in `syncEmaSeries`, `applyFocus` / `pendingFocusRef`, `onLoadNewer` trigger, `candlesKind` re-anchoring). Grep proves each prop is passed only by `features/backtest/`. The `candlesKind === undefined` prepend path stays byte-for-byte. `npm run build`, then full manual checklist. Skip or revert per the stop rule. — Design § Group B; § Chart safety protocol. `refactor(frontend): drop backtest-only chart props` [SP: 5]

- [ ] 7. Delete `features/backtest/` and `features/engine/`; remove their imports and routes from `Router.tsx`; remove `IconBacktest` / `IconEngine` from the `AppLayout.tsx` import and the two disabled nav entries (plus the `disabled` rendering branch if no entry uses it any more); delete both icons from `shared/ui/icons.tsx`. `npm run build` passes. — Design § Frontend — delete / modify. `refactor(frontend): remove backtest and engine pages` [SP: 2]

- [ ] 8. Verify locally against the VPS backend: login, Journal, Chart (full checklist once more), Scanner and Settings pages work; browser console clean. No commit; record the result in Outcome. Frontend is deployed only when the user asks. — Requirements AC 10, 11. [SP: 1]

## Database

- [ ] 9. Remove the `Strategy`, `BacktestRun`, `BacktestSetup`, `BacktestTrade` models from `schema.prisma`, run `prisma generate`, add `prisma/migrations/20260910000000_drop_engine_backtest_tables/migration.sql` with the four `DROP TABLE IF EXISTS` statements in FK order. `npm run build` passes. **Push only after the user confirms**; the deploy applies the migration unattended. Afterwards check on the VPS that the four tables are gone and `settings_mirror` still exists. — Design § Data model / API. `chore(db): drop engine and backtest tables` [SP: 2]

## Estimation

Total: 19 SP (14 SP without the optional task 6).

Reference: no prior specs — baseline estimates. Calibration notes for future specs: tasks 1–3 and 7 are mechanical deletions with a build gate (1–2 SP); task 5 is a surgical edit in a large shared component with a manual test pass (3 SP); task 6 is the same but touches data-loading logic (5 SP).

## Outcome

_(filled in by /spec-implement)_
