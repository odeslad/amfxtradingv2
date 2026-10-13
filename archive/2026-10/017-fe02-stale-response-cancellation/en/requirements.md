# 017 · FE-02 — Stale response cancellation

> Status: **closed**
> Origin: [frontend audit 2026-10-08](../../../reports/2026-10-08-frontend.md), improvement 2 (diagnosis C)

## Context

No data-loading effect in the frontend cancels or discards its request when its inputs change: there are zero `AbortController` in `src/` and only three `cancelled` flags (`StatsPage`, `NewTradePanel`, `useBuildInfo`). Everywhere else the arrival order decides the state. In `ChartPage.tsx` this affects candles (`:347-368`), drawings (`:370-377`), symbols (`:215-225`), the REST positions snapshot (`:332-345`) and load-more (`:395-416`); in the journal, `OpenPositions.tsx:57-77` (the REST snapshot can overwrite a newer WebSocket one) and `ClosedPositions.tsx:32-44`; in the scanner, `useScanner.ts:43-60` (two runs in flight, the older one wins if it arrives last).

Drawings are the only case that corrupts data: switching from EURUSD to GBPUSD quickly can leave EURUSD's drawings loaded on the GBPUSD chart, and because `saveDrawings` captures the current broker/symbol (`:379-388`), any edit made before the GBPUSD response arrives persists EURUSD's drawings under GBPUSD.

Two related defects live next to this code. `LightweightChart` keeps its own `isLoadingMoreRef` and only resets it when a load-more delivers candles (`:714`); if the page is empty (`hasMore` becomes false) or the request fails, the flag stays `true` and infinite scroll is blocked until the chart is remounted. And when the broker changes, the symbol is never re-chosen: the `if (!initSymbol)` guard in `ChartPage.tsx:221` is always false after mount (the `eslint-disable` on `:224` hides it), so a broker that does not list the current symbol shows an empty chart.

This spec cancels or discards stale responses at those sites and fixes the two adjacent defects. It does not introduce the shared `apiFetch` layer (FE-03): the pattern is applied to the existing `fetch` calls so FE-03 can later migrate them with the cancellation already in place.

## Affected layers

- frontend

No backend, db, EA or infra change. No new dependencies.

## User stories

- As a trader, I want the chart, drawings and candles to always belong to the symbol I selected last, so that a fast sequence of symbol changes never shows or saves the wrong symbol's data.
- As a trader, I want infinite scroll on the chart to keep working after reaching the oldest candle or after a failed load, so that I do not have to reload the page to scroll back in time.
- As a trader, I want the chart to pick a valid symbol when I switch to a broker that does not offer the current one, so that I never land on an empty chart.
- As a trader, I want the journal and the scanner to show the result of my latest filter or run, so that an older slow response never overwrites a newer one.

## Acceptance criteria

- AC 1. WHEN broker, symbol or timeframe changes while a candles, drawings or symbols request is in flight THEN that request is aborted (or its result discarded) and only the response matching the current selection reaches state.
- AC 2. WHEN the user edits drawings after a symbol change THEN the saved payload always carries the drawings loaded for the current broker/symbol/timeframe, never a previous symbol's drawings (verified by comparing `GET /drawings` for both symbols before and after the test).
- AC 3. WHEN a load-more request completes after broker, symbol or timeframe changed THEN its candles are discarded instead of being prepended to the new series.
- AC 4. WHEN a load-more request returns no candles or fails THEN the chart's load-more guard is released, and the next scroll to the left edge can trigger a new request when `hasMore` is still true.
- AC 5. WHEN the broker changes and the current symbol is not in the new broker's symbol list THEN the chart selects EURUSD if available, otherwise the first symbol of the list; if the current symbol is in the list it is kept.
- AC 6. WHEN `positionsMode` or broker changes in the chart while a `/positions/live` request is in flight THEN the stale response is discarded.
- AC 7. WHEN the journal's `OpenPositions` unmounts, or a WebSocket `positions` message arrives, before the REST `/positions/live` snapshot THEN the snapshot does not overwrite the newer state.
- AC 8. WHEN the journal's date range changes while a `/trades` request is in flight THEN the older response is discarded and `loading` reflects only the latest request.
- AC 9. WHEN the scanner is run again while a previous run is in flight THEN only the latest run's result is shown and `loading` clears only when the latest run finishes.
- AC 10. WHEN a request is aborted THEN no error toast, no `setError` and no state reset is produced by the abort itself (an `AbortError` is silent).
- AC 11. WHEN the implementation is complete THEN `npx eslint .` and `npm run build` pass in `frontend/`, and the `eslint-disable` on the symbols effect is removed.

## Out of scope

- Shared `apiFetch<T>()` helper, `sendCommand`, 401 handling and deep-link return after login (FE-03).
- Shared positions hook, data caches and WebSocket reconnection refresh (FE-05).
- Per-tick render optimisations (FE-04).
- Cancellation for the three sites that already have a `cancelled` flag (`StatsPage`, `NewTradePanel`, `useBuildInfo`): they stay as they are.
- Settings, chart-indicators and balances loads in `ChartPage` (mount-only, no changing inputs; they belong to FE-05's cache).
