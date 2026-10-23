# 019 · FE-04 — Per-tick rendering · Verification

| Task | Mechanism | Outcome | Est | Actual |
|---|---|---|---|---|
| 1 | manual (render counter in the console, 10 s windows) | ✅ | 0.5 | 0.25 |
| 2 | `npm run build` + `npx eslint .` + counter + local app (user) | ✅ | 0.75 | 0.75 |
| 3 | `npm run build` + `npx eslint .` + local app (user) | ✅ | 1 | 0.75 |
| 4 | `npm run build` + `npx eslint .` + local app (user) | ✅ | 0.75 | 0.5 |
| 5 | — (dropped: the Scanner was removed by spec 022) | — | 0.5 | 0 |
| 6 | `npm run build` + `npx eslint .` + counter + local app (user) | ✅ | 0.75 | 1 |

Measurement deviation: the React DevTools Profiler could not be driven from the operator's side, so a temporary `useRenderRate(name)` hook (not committed) counted renders of `ChartPage`, `LightweightChart` and `JournalPage` and logged renders/s to the browser console every 10 s; the user read the lines. Same unit as the spec's targets.

## Task 1 — Baseline (frontend)

- Local app (Vite 5174 against the production API, ticks flowing, 2026-10-23), 10 s windows at rest:

| Page | Component | Before |
|---|---|---|
| `/chart`, alerts panel closed | `ChartPage` | 13.2–14.4 renders/s |
| `/chart`, alerts panel closed | `LightweightChart` | 12.8–17.6 renders/s |
| `/journal`, Positions | `JournalPage` | 12.8–22.2 renders/s (12 brokers, positions on most) |

- The scanner page no longer exists (spec 022), so it has no baseline.
- Est vs Actual: 0.5 vs 0.25 SP.

## Task 2 — Live candle out of page state (frontend)

- `LightweightChart`: `export interface ChartHandle { updateLive(candle | null) }`, a `ref?: Ref<ChartHandle>` prop (React 19 passes `ref` as a prop) exposed with `useImperativeHandle`; `updateLive` is the former live-candle effect as a `useCallback` (reads `seriesRef` / `candlesRef`, `null` clears `liveCandleTimeRef`); the `liveCandle` prop and its effect are gone. `ChartPage`: `chartRef` + `liveCandleRef`; the WS handler builds the candle, stores it and calls `updateLive`; the candles effect resets both on a selection change; `panelPrice` state is fed only while the alerts panel is open and seeded by `toggleAlerts` when opening (AC 1, 2).
- Found on the way: the chart raises `crosshairMove` on every data update too, and the component stored a fresh OHLC object each time → `LightweightChart` still 10–12 renders/s with `ChartPage` at 0. `setHoverOhlc` now keeps the previous state when the hovered OHLC is unchanged.
- After: `ChartPage` 0 renders/s, `LightweightChart` 0.4 renders/s with the panel closed; the candle moves after a pair / timeframe change (a stale `ref` after Vite's hot reload needed one full reload, not a code issue); the alerts panel price moves while open. Validated by the user.
- Est vs Actual: 0.75 vs 0.75 SP.

## Task 3 — Positions only when they change (frontend)

- `ChartPage`: `positionsSignature` (ticket, type, lots, open, SL, TP, profit) with `acceptPositions` gating `setPositions` for both the WS message and the REST snapshot; `positions` messages ignored in mode `none`; the signature is cleared by the positions effect when the mode is `none` or no broker. `LightweightChart` positions effect: price lines reconciled (existing line → `applyOptions` with price, colour, width and style; new → `createPriceLine`; the ids not seen → `removePriceLine`), markers plugin rebuilt only when the `time|shape` key changes; both reset on chart teardown (AC 3–6).
- User check: lines keep their identity across updates (no flicker), SL dragged during ticks, selection highlight survives an update. Validated by the user.
- Est vs Actual: 1 vs 0.75 SP.

## Task 4 — Memoised panels and stable handlers (frontend)

- `memo` on `AlertsPanel`, `IndicatorsPanel`, `ChartFiltersPanel`, `ChartToolbar`, `NewTradePanel`, `BulkEditPanel`, `ClosePositionPanel` (`export const X = memo(function X …)`); `ChartPage` handlers as `useCallback` (`openIndicators`, `closeIndicators`, `openFilters`, `closeFilters`, `toggleAlerts`, `closeAlerts`, `toggleDrawMode`, `clearDrawMode`, `cyclePositions`, `openNewTrade`, `closeNewTrade`, `clearEdit`, `clearClose`) and `editPositions` memoised (AC 7).
- User check: each panel reflects a broker / symbol change. Validated by the user.
- Est vs Actual: 0.75 vs 0.5 SP.

## Task 5 — Scanner (dropped)

- The Scanner page, hook and route were removed by spec 022 before this task started; nothing to do. Recorded as an agreed deviation, AC 8 void.

## Task 6 — Journal: live feed outside page state (frontend)

- `useLivePositions.ts` rewritten as an external store (`useSyncExternalStore`): `useLivePositionsFeed()` mounted by `JournalPage` runs the REST snapshot + WS merge into a module snapshot with a per-broker signature gate and `openedAt` precomputed by a shared `normalize`; `useLivePositions()` subscribes a component to positions + colours; `useLivePositionsByKeys(keys)` gives an edit / cancel panel its live rows with a cached selector; `setLiveColor` updates the colour map. `OpenPositions` and `PendingOrders` subscribe themselves and filter market / pending; their `onOptionsChange` fires only when the options key changes and `onBulkChange` / `onGroupChange` only when the tickets or SL / TP change (AC 9). `Accounts`: the daily P&L poll stops while the tab is hidden and restarts with one immediate request when shown (AC 10).
- After: `JournalPage` 2.8 renders/s in the first 10 s (load) and 0 renders/s for the next 40 s; Positions and Orders keep updating live, colours and the group badge work, the order panels show the moving distance. Validated by the user.
- Est vs Actual: 0.75 vs 1 SP (+0.25: the 021 structure put the feed in the page, so the store was needed to reach 0 renders/s).
