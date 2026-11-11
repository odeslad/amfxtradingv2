# 042 — Chart render throttle · Verification

## Task 1 · [frontend] Tick scheduler in `LightweightChart`

- **Mechanism:** `npm run build` + eslint + manual on the local stack against the production API.
- **Commands:** `npm run build` → ✓ built · `npx eslint src/features/chart/LightweightChart.tsx` → clean.
- **Implementation:** `updateLive` now stores the tick in `pendingLiveRef` (quote updated at once for the spread lines) and calls `scheduleApply`; `scheduleApply` is a no-op while a timer is set, the tab is hidden or nothing is pending, otherwise it requests a frame now or after the remainder of `LIVE_MIN_INTERVAL_MS` (250 ms); `applyPending` takes the latest tick and runs the former body (`applyLive`); a `null` tick cancels and resets as before; `visibilitychange` to visible re-schedules; unmount cancels.
- **Manual steps (user):** Vite against the production API, chart on M5 with 3 EMAs and the spread on. Expect: (1) live candle, EMAs and bid/ask lines move smoothly but no faster than ≈ 4 times per second; (2) switch to another tab for 10 s and come back → the candle jumps to the current price within 250 ms and keeps moving; (3) change symbol → no stale candle from the previous one.
- **Outcome:** 🕐 pending the user's manual check.
- **Est vs Actual:** 1 SP · 0.5 SP so far.
