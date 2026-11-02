# 036 — Chart split view · Verification

## Task 1 · [frontend] Extract `ChartSlot` from `ChartPage`

- **Mechanism:** `npm run build` + manual check in the local app.
- **Commands:** `cd frontend && npm run build` → ✓ built; `npx eslint src/features/chart/ChartPage.tsx src/features/chart/ChartSlot.tsx` → clean.
- **Outcome:** ✅ pass (user checked the list below on 2026-11-02 against the production API through the local Vite proxy).
- **Manual steps (local, single chart, must behave as today):** change timeframe · scroll left to page older candles · live candle moves with ticks · draw and reload keeps the drawings · lock on/off · positions cycle none/all/buys/sells and New Trade button appears · tap an alert → action bar · fullscreen in/out · Ctrl+Arrows cycle symbol/broker · New Trade from the toolbar preselects broker/symbol/timeframe · alerts panel shows the live price.
- **Deviation from design.md:** fullscreen stays on the page element (not the slot wrapper): the side panels are `position: fixed` children of `.page`, so a slot in native fullscreen would hide them. Split-mode fullscreen will show only the fullscreen slot inside the page (task 3); design.md to be updated accordingly.
- **Est vs Actual:** 2 SP · 1.25 SP.

## Task 2 · [frontend] Split button in `ChartToolbar`

- **Mechanism:** `npm run build` + button visible/active on desktop, absent on mobile width.
- **Commands:** `npm run build` → ✓ built; `npx eslint src/features/chart src/shared/ui/icons.tsx` → clean.
- **Outcome:** ✅ pass (user checked on 2026-11-02 in the local app: button next to Fullscreen, toggles active, hidden under 768 px). The page holds a temporary `useState` toggle that task 3 replaces with the persisted split state.
- **Est vs Actual:** 0.5 SP · 0.25 SP.

## Task 3 · [frontend] Split state and layout

- **Mechanism:** `npm run build` + manual: open split, change each timeframe, change broker/symbol, live ticks on both, close from the right chart, reload keeps the split.
- **Commands:** `npm run build` → ✓ built; `npx eslint src/features/chart src/lib/useMediaQuery.ts` → clean.
- **Outcome:** ✅ pass (user checked on 2026-11-02 in the local app against the production API). First render overflowed on the right: `fr` grid columns do not shrink below the toolbar's min-content width → `minmax(0, Nfr)` columns.
- **Notes:** `useMediaQuery` uses `useSyncExternalStore` (the lint rule rejects setState inside an effect). Fullscreen per slot implemented as "page fullscreen, only that slot rendered" (see design.md risks).
- **Est vs Actual:** 1.5 SP · 1 SP.

## Task 4 · [frontend] Draggable divider

- **Mechanism:** `npm run build` + manual drag to both limits, reload keeps the ratio, close from each side and reopen.
- **Commands:** `npm run build` → ✓ built; `npx eslint src/features/chart` → clean.
- **Outcome:** ✅ pass (user checked on 2026-11-02 in the local app).
- **Changes agreed during the task:** the 25 % floor was not enough (toolbar buttons were clipped) → the clamp also uses the toolbar's min-content width, measured from its two groups, and a `ResizeObserver` re-clamps a persisted ratio on a narrower window; closing from the right chart keeps its timeframe (AC 5 reworded) and the closed pair (`leftTimeframe` + `rightTimeframe`) is restored on reopen. Task 5 loses the compact toolbar.
- **Est vs Actual:** 0.75 SP · 0.75 SP.
