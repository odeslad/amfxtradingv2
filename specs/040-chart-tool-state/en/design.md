# 040 — Chart tool state remembered per chart · Design

## Approach

One hook, `useChartToolState(side)`, owns the three per-side toggles of the toolbar (lock, EMA cross trades, Positions mode) on top of the existing `useLocalStorage`, with the storage keys the lock and the overlay already use and a new pair for Positions. `ChartSlot` replaces its two `useLocalStorage` calls and the `useState` of `positionsMode` with that hook; everything downstream (toolbar props, filtered positions, `showNewTrade`) stays as it is. No visual change, no backend.

## Alternatives

- **One JSON object per side** (`chart.tools.left = { locked, emaTrades, positions }`): tidier keys, but it needs a migration of the four keys already saved in the users' browsers or loses them. Rejected: AC 4 asks to keep the current keys.
- **Keep adding `useLocalStorage` calls in `ChartSlot`**: works, but the fourth copy of the same `KEY[side]` wiring is what the spec wants to stop. Rejected.

## Per-layer changes

### frontend

**`features/chart/useChartToolState.ts`** (new)
- `export type ChartSide = 'left' | 'right'` moves here from `ChartSlot` (re-exported there so `ChartPage` keeps importing it from `./ChartSlot`).
- `const TOOL_KEYS: Record<ToolKey, Record<ChartSide, string>>` → `locked`: `chart.locked` / `chart.locked.right`; `emaTrades`: `chart.emaTrades` / `chart.emaTrades.right`; `positions`: `chart.positions` / `chart.positions.right`.
- `useChartToolState(side)` returns `{ locked, setLocked, emaTradesOn, setEmaTradesOn, positionsMode, setPositionsMode }`, each pair from `useLocalStorage(TOOL_KEYS[tool][side], default)`.
- Positions mode validation (AC 5): `useLocalStorage` already falls back on missing / corrupt JSON, but a stored string outside `none | all | buys | sells` would pass JSON parsing; the hook maps anything unknown back to `'none'` when reading (`isPositionsMode(value) ? value : 'none'`).

**`features/chart/ChartSlot.tsx`**
- Replace `useLocalStorage(LOCK_KEY[side], false)`, `useLocalStorage(EMA_TRADES_KEY[side], false)` and `useState<PositionsMode>('none')` with the hook; delete `LOCK_KEY` and `EMA_TRADES_KEY`.
- `cyclePositions` keeps `POSITIONS_MODE_CYCLE`, now through `setPositionsMode(prev => …)` from the hook. The toolbar, `chartPositions` and `showNewTrade` read `positionsMode` as today.
- `toggleDrawMode` still unlocks (`setLocked(false)`), which is also persisted, as today.

**`features/chart/ChartToolbar.tsx`, `ChartPage.tsx`** · no change: the props are the same values.

## Data flow

Browser only: `localStorage` ⇄ `useChartToolState` ⇄ `ChartSlot` props. Nothing leaves the browser.

## Risks

- **Selection change** (AC 3): the tool state is keyed by side, not by selection, so it survives broker / symbol / timeframe changes; that is the intended behaviour and matches the lock today.
- **Positions restored on load**: `chartPositions` filters the WS positions list; on first render the list may be empty until the fetch lands, so the chart shows the positions a moment later, as it does today when the user cycles the button.

## Mockup

No new screen or state: the toolbar, the button and the drawn positions look exactly as today; the only change is that the Positions mode comes back after a reload. Agreed with the user on 2026-11-09 that no canvas is needed (reference: the current chart toolbar and the Positions button cycle).
