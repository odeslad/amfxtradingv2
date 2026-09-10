# 001 — Remove trading engine and backtest

## Context

The trading engine (`backend/src/engine/`) and the backtest subsystem (backend service, `/strategies` route, frontend Backtest page, four Prisma models) were built during Phase 2 but never reached a working state: the live engine is a stub that evaluates nothing, and the Backtest and Engine navigation entries are already disabled. The code still ships in both bundles, the `/strategies` endpoint is still exposed and can trigger heavy backtest runs, and four unused tables remain in the database. This spec removes all of it while preserving the shared modules that other features depend on.

## User stories

- As the maintainer, I want the engine and backtest code removed from backend and frontend so that the codebase only contains features that are actually in use.
- As the maintainer, I want the four backtest tables dropped from the database so that the schema matches the running application.
- As a user of the app, I want the live chart, scanner, EMA-cross alerts, journal and settings to keep working exactly as before, so that the cleanup is invisible to me.

## Acceptance criteria

1. WHEN the backend starts THEN the system SHALL NOT import, construct or reference the `Engine` class, and the `FEATURE_ENGINE` flag SHALL no longer exist in `config.ts`.
2. WHEN a client calls any path under `/strategies` THEN the backend SHALL respond 404 (route not mounted).
3. The following backend files SHALL be deleted: `engine/engine.ts`, `engine/candle-tracker.ts`, `engine/strategy-evaluator.ts`, `engine/order-executor.ts`, `engine/evaluators/setup-evaluator.ts`, `engine/evaluators/entry-evaluator.ts`, `engine/evaluators/entry/*`, `services/backtest.ts`, `routes/strategies.ts`.
4. The shared modules `indicators/ema.ts`, `pip-size.ts`, `timeframe.ts` and `evaluators/ema-cross.ts` SHALL be preserved, relocated out of `engine/`, and the directory `backend/src/engine/` SHALL no longer exist.
5. WHEN the relocation is done THEN `services/scanner.ts`, `routes/scanner.ts`, `routes/setup-levels.ts`, `routes/candles.ts` and `alerts/ema-alert-evaluator.ts` SHALL compile and behave identically (same imports resolved, no logic change).
6. The Prisma models `Strategy`, `BacktestRun`, `BacktestSetup` and `BacktestTrade` SHALL be removed from `schema.prisma`, and a new migration SHALL drop the tables `backtest_trades`, `backtest_setups`, `backtest_runs`, `strategies` in that order.
7. The `SettingsMirror` model and the `settings_mirror` table SHALL remain untouched.
8. Existing migration folders SHALL NOT be edited or deleted.
9. The frontend directories `features/backtest/` and `features/engine/` SHALL be deleted, together with the `/backtest` and `/engine` routes, their nav entries in `AppLayout.tsx` and the `IconBacktest` / `IconEngine` icons.
10. The `backtestOverlay` prop, its types and the `drawBacktestOverlay` logic SHALL be removed from `LightweightChart.tsx`, and the live chart page SHALL render candles, EMAs, drawings, positions and alerts exactly as before.
11. `npm run build` SHALL succeed in both `backend/` and `frontend/` with zero TypeScript errors after each commit.
12. WHEN the backend is deployed THEN `prisma migrate deploy` SHALL apply the drop migration without manual intervention on the VPS.
13. No new dependencies SHALL be added.

## Out of scope

- Any redesign or future re-implementation of the engine or backtest. The strategy design documented in `.claude/CLAUDE.md` is kept as reference.
- Changes to the EA (`ea/`), the pipe/file-watcher bridge, or the WebSocket protocol.
- Removing the other feature flags (`FEATURE_PIPE`, `FEATURE_WATCHER`, `FEATURE_ALERTS`, `FEATURE_WS_BROADCAST`).
- Cleaning up `.claude/CLAUDE.md` sections that describe the engine (can be done in a separate docs commit).
- Backing up the data in the four dropped tables. They contain only test runs; the drop is intentional and final.
