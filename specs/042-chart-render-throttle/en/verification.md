# 042 — Chart render throttle · Verification

## Task 1 · [frontend] Tick scheduler in `LightweightChart`

- **Mechanism:** `npm run build` + eslint + manual on the local stack against the production API.
- **Commands:** `npm run build` → ✓ built · `npx eslint src/features/chart/LightweightChart.tsx` → clean.
- **Implementation:** `updateLive` now stores the tick in `pendingLiveRef` (quote updated at once for the spread lines) and calls `scheduleApply`; `scheduleApply` is a no-op while a timer is set, the tab is hidden or nothing is pending, otherwise it requests a frame now or after the remainder of `LIVE_MIN_INTERVAL_MS` (250 ms); `applyPending` takes the latest tick and runs the former body (`applyLive`); a `null` tick cancels and resets as before; `visibilitychange` to visible re-schedules; unmount cancels.
- **Manual steps (user):** Vite against the production API, chart on M5 with 3 EMAs and the spread on. Expect: (1) live candle, EMAs and bid/ask lines move smoothly but no faster than ≈ 4 times per second; (2) switch to another tab for 10 s and come back → the candle jumps to the current price within 250 ms and keeps moving; (3) change symbol → no stale candle from the previous one.
- **Outcome:** 🕐 pending the user's manual check.
- **Est vs Actual:** 1 SP · 0.5 SP so far.

## Task 2 · [frontend] `afterScaleChange()` + `DrawingTools.onScaleChange()`

- **Mechanism:** `npm run build` + eslint + manual.
- **Commands:** `npm run build` → ✓ built · `npx eslint src/features/chart/LightweightChart.tsx src/features/chart/DrawingTools.ts` → clean · grep `requestAnimationFrame` under `features/chart` → no loops left: one-shot uses (input focus, error boundary retry, slot loading), the coalesced interaction check and the tick scheduler.
- **Implementation:** the 60 fps effect became `afterScaleChange` (same two signature checks, signatures in refs, then `trendlineManagerRef.current?.onScaleChange()`), called from `applyPending`, the visible-range handler, the `ResizeObserver`, `fitPrice` and a passive `pointermove` (buttons pressed) / `pointerup` / `wheel` / `touchmove` / `touchend` listener on the container coalesced to one frame. `DrawingManager` lost `rafId` / `scheduleRaf`; `onScaleChange()` repaints when the anchor Y moved more than 0.5 px and `resetScaleAnchor()` (the former `scheduleRaf` call sites) forces the next repaint.
- **Manual steps (user):** folded into the production validation of task 4: position labels, alert markers, drawings and the ruler follow scroll, zoom, price-axis drag and resize; DevTools Performance shows no periodic activity with no ticks (weekend) or with the tab idle.
- **Outcome:** 🕐 build and lint pass; manual check in task 4.
- **Est vs Actual:** 1.25 SP · 0.75 SP so far.
