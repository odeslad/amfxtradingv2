# 019 · FE-04 — Per-tick rendering

> Status: **closed**
> Origin: [frontend audit 2026-10-08](../../../reports/2026-10-08-frontend.md), improvement 4 (diagnoses D, E)

## Context

Every WebSocket tick ends up in React state at page level, so whole pages re-render at the broker's tick rate. On `/chart`, each `ticks` batch for the selected broker calls `setLiveCandle` (`ChartPage.tsx:296-302`), which re-renders the page about ten times per second with everything mounted under it: toolbar, `AlertsPanel`, `IndicatorsPanel`, `ChartFiltersPanel`, `NewTradePanel`, `BulkEditPanel` (which also receives a fresh `[editPosition]` array on every render), `ClosePositionPanel` and `LightweightChart`, whose only use of the value is a `series.update` inside an effect (`LightweightChart.tsx:736-766`). The `positions` message is stored every second even when `positionsMode` is `none` (`ChartPage.tsx:281-288`), and each new array makes the chart's positions effect (`LightweightChart.tsx:768-865`) remove and recreate every price line and the markers plugin, walking the candle history backwards per position.

On `/journal`, the three tabs stay mounted (hidden by CSS). `OpenPositions` stores every `positions` message, sorting with `openTimeMs(...)`, a date parse, inside the comparator, and then calls `onOptionsChange` with new arrays on each change, so `JournalPage` re-renders with all three tabs. `Accounts` polls `/balances/daily-pnl` every five seconds even when the tab is hidden. On `/scanner`, every tick batch copies the whole `bids` object (`ScannerPage.tsx:181-189`), and the bids of the previous broker survive a broker change.

There are zero `React.memo` and zero `useSyncExternalStore` in the codebase. This spec keeps the live price and the live positions out of page-level state where they do not need to be there, stops rebuilding chart objects that have not changed, and makes the panels skip renders whose props did not change. It measures the result with the React Profiler: at rest (no user interaction, ticks flowing) the pages should not re-render.

## Affected layers

- frontend

No backend, db, EA or infra change. No new dependencies.

## User stories

- As a trader, I want the chart page to stay responsive while ticks flow (panels open, drawing, panning), so that the UI never stutters at the broker's tick rate.
- As a trader, I want the position lines on the chart to stay put while P&L updates, so that a line I am looking at (or dragging) does not get destroyed and recreated every second.
- As a trader, I want the journal and the scanner to update only the numbers that changed, so that the pages stay cheap with twelve brokers streaming.
- As a trader, I want the app to stop polling while the tab is hidden, so that a background tab does not spend network or battery.

## Acceptance criteria

- AC 1. WHEN ticks arrive for the selected broker and symbol THEN the live candle on the chart updates at tick rate, and `ChartPage` does not re-render for it (React Profiler: 0 renders of `ChartPage` per second at rest with the alerts panel closed).
- AC 2. WHEN the alerts panel is open THEN it shows the current price as today; WHEN it is closed THEN no tick reaches it and it does not re-render.
- AC 3. WHEN a `positions` message arrives and `positionsMode` is `none` THEN it is ignored (no state update, no effect run).
- AC 4. WHEN a `positions` message arrives with the same positions (same ticket, type, lots, open price, SL, TP, profit) as the previous one THEN no state update happens.
- AC 5. WHEN positions change (a new one, one closed, SL/TP moved, profit changed) THEN existing price lines are updated in place with `applyOptions` and only new lines are created and gone lines removed; the markers plugin is rebuilt only when the set of entries (ticket + open time) changes.
- AC 6. WHEN a level is being dragged and a `positions` update arrives THEN the drag continues on the same price-line object (no flicker, no lost drag).
- AC 7. WHEN `ChartPage` re-renders for a legitimate reason (selection change, panel open/close) THEN the panels whose props did not change (`AlertsPanel`, `IndicatorsPanel`, `ChartFiltersPanel`, `NewTradePanel`, `BulkEditPanel`, `ClosePositionPanel`, `ChartToolbar`) skip their render; handlers passed to them are referentially stable and `BulkEditPanel` receives a memoised positions array.
- AC 8. WHEN tick batches arrive on `/scanner` THEN bids are accumulated outside React state and flushed at most once per animation frame, and only when at least one value changed; WHEN the broker changes THEN the bids map is cleared.
- AC 9. WHEN a `positions` message arrives on `/journal` THEN `OpenPositions` sorts with a precomputed open-time number (no date parsing in the comparator) and calls `onOptionsChange` only when the sets of brokers, symbols or colours actually differ, so `JournalPage` does not re-render on ticks (Profiler: 0 renders of `JournalPage` per second at rest).
- AC 10. WHEN the document is hidden THEN the daily-P&L poll in `Accounts` stops; WHEN it becomes visible THEN it fetches immediately and resumes the interval.
- AC 11. WHEN the implementation is complete THEN `npx eslint .` and `npm run build` pass in `frontend/`, and the production app behaves as before on `/chart` (live candle, legend, positions lines and labels, drag of SL/TP, alerts panel price, New Trade bid), `/journal` (live P&L, filters, bulk) and `/scanner` (live distances).

## Out of scope

- Shared `useLivePositions` / data provider / typed WS union (FE-05).
- Splitting `LightweightChart` and `ChartPage` into hooks, rollover caching, `devicePixelRatio` on canvases, rAF only when something changed (FE-11).
- Shared `SidePanel` (FE-07) and UI primitives (FE-12).
- A state-management library or a global store: the changes use refs, `useSyncExternalStore` where a subscription is needed, and `React.memo`.
- Reducing the broker's tick rate or the backend's `positions` cadence.
