# 001 — Remove trading engine and backtest · Design

## Approach

Delete the engine and backtest subsystems layer by layer, keeping the build green after every commit. The four modules that other features depend on are moved first to a neutral folder, `backend/src/indicators/`, so the `engine/` directory can then be removed wholesale. Frontend work follows the same pattern: excise the backtest-only code from the shared chart component before deleting the feature folders, so the chart page is verified in isolation. The database is touched last, in its own commit, with a single forward migration that drops the four tables.

Sequence: backend code → frontend code → database. Backend is deployed first; the frontend is deployed when the user asks (project rule). Between those two deploys the app keeps working because the Backtest and Engine nav entries are already disabled, so no client calls `/strategies`.

**Discarded alternatives**

- *Feature flag only* (`FEATURE_ENGINE=false` + `FEATURE_BACKTEST`): zero risk but leaves ~3,900 dead lines and four tables. Rejected because the user wants full removal.
- *Delete code, keep tables*: avoids a destructive migration but leaves the Prisma schema and the database carrying unused models. Rejected for the same reason. It remains the natural stopping point if the migration step is postponed.
- *Move shared modules to `backend/src/shared/`*: the four files are all market-analysis helpers (EMA, EMA cross, pip size, timeframe), so a descriptive folder name (`indicators/`) is clearer than a generic one.

## Affected files

### Backend — move (keep, relocate)

| From | To |
|---|---|
| `backend/src/engine/indicators/ema.ts` | `backend/src/indicators/ema.ts` |
| `backend/src/engine/evaluators/ema-cross.ts` | `backend/src/indicators/ema-cross.ts` (its own import becomes `./ema`) |
| `backend/src/engine/pip-size.ts` | `backend/src/indicators/pip-size.ts` |
| `backend/src/engine/timeframe.ts` | `backend/src/indicators/timeframe.ts` |

Import sites to update (path only, no logic change):

- `backend/src/alerts/ema-alert-evaluator.ts` lines 4–5
- `backend/src/services/scanner.ts` lines 2–5
- `backend/src/routes/candles.ts` line 3 (also drop the comment on line 7 that mentions the backtest)
- `backend/src/routes/setup-levels.ts` lines 3–5

### Backend — delete

- `backend/src/engine/engine.ts`
- `backend/src/engine/candle-tracker.ts`
- `backend/src/engine/strategy-evaluator.ts`
- `backend/src/engine/order-executor.ts`
- `backend/src/engine/evaluators/setup-evaluator.ts`
- `backend/src/engine/evaluators/entry-evaluator.ts`
- `backend/src/engine/evaluators/entry/` (activation, scan, sl, trail, exit, sizing)
- `backend/src/services/backtest.ts`
- `backend/src/routes/strategies.ts`

### Backend — modify

- `backend/src/index.ts`: remove the `Engine` import (line 18), the `engine` construction (line 30) and the `engine?.processTicks(batch)` call (line 39).
- `backend/src/config.ts`: remove the `engine: flag('FEATURE_ENGINE')` entry (line 34).
- `backend/src/app.ts`: remove the `strategiesRouter` import (line 10) and mount (line 44).
- `backend/prisma/schema.prisma`: remove models `Strategy`, `BacktestRun`, `BacktestSetup`, `BacktestTrade` (lines 48–120).

### Backend — create

- `backend/prisma/migrations/20260910000000_drop_engine_backtest_tables/migration.sql`

### Frontend — delete

- `frontend/src/features/backtest/` (entire folder: page, panels, editors, hooks, types, defaults, styles)
- `frontend/src/features/engine/` (placeholder page)

### Frontend — modify

- `frontend/src/app/Router.tsx`: remove imports (lines 8–9) and routes `/backtest`, `/engine` (lines 29–30).
- `frontend/src/app/layout/AppLayout.tsx`: remove `IconBacktest`, `IconEngine` from the import (line 4), the two disabled nav entries and the comment above them (lines 14–16). If `disabled` is no longer used by any entry, drop its handling in the render as well.
- `frontend/src/shared/ui/icons.tsx`: remove `IconBacktest` and `IconEngine`.
- `frontend/src/features/chart/LightweightChart.tsx`: see below.

## LightweightChart excision

The component is shared with the live chart page, so changes are limited to removing code paths that only the deleted `BacktestChart` exercised. Two groups:

**Group A — backtest overlay (required by acceptance criterion 10)**

- Exported types `BacktestOverlayLevels`, `BacktestOverlayTrade`, `BacktestOverlaySetup`, `BacktestOverlayLayers`, `BacktestOverlay` (lines 177–220).
- Prop `backtestOverlay` (lines 223, 249) and `backtestOverlayRef` with its sync effect (lines 260–264).
- `drawBacktestOverlay` callback (lines 467–680) and its call inside the canvas repaint (line 906) plus the dependency entry (line 908).
- The per-frame scale watcher (lines 1130–1144) exists only to repaint the overlay on vertical rescale. Remove the whole `requestAnimationFrame` loop and its cancel in the cleanup.
- Comment at lines 1382–1383 and `backtestOverlay` in the dependency array at line 1395.

**Group B — backtest-only chart props (recommended, same commit)**

These props are passed only by `BacktestChart.tsx` and become dead once it is deleted: `focusRange`, `candlesKind`, `emaData`, `onLoadNewer`, `hasNewer`. Removing them deletes the backend-EMA branch in `syncEmaSeries` (lines 945–967), the `applyFocus` / `pendingFocusRef` logic, the `onLoadNewer` trigger in the visible-range handler (lines 1105–1107) and the `candlesKind` window re-anchoring in the candles effect (lines 1166–1237). The live chart uses only the `candlesKind === undefined` prepend heuristic, which must be preserved as the sole behaviour.

Group B is a larger edit inside a 1,400-line component. It is included because leaving five unused props on a shared component contradicts the goal of the spec, but it is written as its own task so it can be dropped or postponed without affecting the rest.

## Chart safety protocol

Not breaking the live chart is the top priority of this spec. The following rules apply to every edit of `LightweightChart.tsx`:

1. **Deletion only.** No code path used by the live chart is rewritten, reordered or "simplified". Each removed block must be one that is reachable only when a backtest-only prop is set. If a block mixes live and backtest logic, only the backtest branch is removed and the live branch is left byte-for-byte identical.
2. **Prove the prop is dead before removing it.** Before touching a prop, grep the whole frontend for its name; it must appear only in `LightweightChart.tsx` and in `features/backtest/`. `ChartPage.tsx` must never pass it.
3. **Two separate commits.** Group A (overlay) and Group B (window props) are committed separately so that either can be reverted alone with `git revert`.
4. **Manual verification after each commit**, on the Chart page, with a real broker and at least two timeframes:
   - candles render and the live candle updates from ticks
   - EMAs from `/chart-indicators` render and follow the live candle
   - scrolling left loads older candles and the view does not jump
   - month rollover markers still draw
   - drawings (trendlines) can be created, moved and persist after reload
   - open positions show entry/SL/TP lines, labels reposition on scroll, SL/TP can be dragged
   - price alert markers show and the alert dialog opens
   - New Trade panel opens from the chart and setup levels load
   - resizing the window redraws correctly
   - no errors in the browser console
5. **Stop rule.** If any item above fails or behaves differently and the cause is not obvious within the same session, the commit is reverted and the spec continues without that group. Group B is optional; Group A is required but can be reduced to the minimum (types, prop, `drawBacktestOverlay`, its call site) if the frame watcher removal proves risky.
6. **Build gate.** `npm run build` (not only `tsc --noEmit`) must pass before each commit.

## Data model / API

**Prisma models removed:** `Strategy`, `BacktestRun`, `BacktestSetup`, `BacktestTrade`. No other model references them. `SettingsMirror` stays.

**Migration** `20260910000000_drop_engine_backtest_tables/migration.sql`, hand-written in the style of the existing `drop_positions_table` migration:

```sql
DROP TABLE IF EXISTS "backtest_trades";
DROP TABLE IF EXISTS "backtest_setups";
DROP TABLE IF EXISTS "backtest_runs";
DROP TABLE IF EXISTS "strategies";
```

Order follows the foreign keys (trade → setup → run → strategy). Sequences owned by the `id` columns are dropped automatically with their tables. Existing migration folders are not modified.

**Endpoints removed:** everything under `/strategies` (`GET /`, `POST /`, `PUT /:id`, `DELETE /:id`, `POST /preview`, `GET /:id/backtest`). No other endpoint changes.

**Env vars removed:** `FEATURE_ENGINE`. If it is set in the VPS `.env` it becomes a harmless unknown variable; no action needed.

## Components

No new React components. `LightweightChart` loses props as described above; its remaining public props are unchanged.

## Risks

- **Live chart regression.** `LightweightChart.tsx` is the only shared file that gets edited in depth. Mitigation: the chart safety protocol above (deletion only, dead-prop proof, separate commits, manual checklist, stop rule).
- **Irreversible drop.** `prisma migrate deploy` runs unattended on every backend deploy, so pushing the migration commit drops the tables in production with no confirmation step. Mitigation: the migration is the last commit of the spec and is pushed only after the user confirms; the tables contain test data only (out of scope to back them up).
- **Deploy ordering.** Backend deploys on push to `master` touching `backend/**`; frontend deploys only when the user asks. Between the two, the old frontend bundle still contains the Backtest page but cannot reach it (nav disabled). No breakage expected.
- **Prisma client drift.** After removing the models, `db.strategy` and `db.backtest*` accessors disappear from the generated client. All their call sites are in files deleted by this spec, verified by grep; the build will catch anything missed.
- **`.claude/CLAUDE.md`** still describes the engine and the strategy JSON. Out of scope; a later `docs:` commit can trim it.
