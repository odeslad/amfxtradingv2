# 042 — Chart render throttle · Verification

## Task 1 · [frontend] Tick scheduler in `LightweightChart`

- **Mechanism:** `npm run build` + eslint + manual on the local stack against the production API.
- **Commands:** `npm run build` → ✓ built · `npx eslint src/features/chart/LightweightChart.tsx` → clean.
- **Implementation:** `updateLive` now stores the tick in `pendingLiveRef` (quote updated at once for the spread lines) and calls `scheduleApply`; `scheduleApply` is a no-op while a timer is set, the tab is hidden or nothing is pending, otherwise it requests a frame now or after the remainder of `LIVE_MIN_INTERVAL_MS` (250 ms); `applyPending` takes the latest tick and runs the former body (`applyLive`); a `null` tick cancels and resets as before; `visibilitychange` to visible re-schedules; unmount cancels.
- **Manual steps (user):** Vite against the production API, chart on M5 with 3 EMAs and the spread on. Expect: (1) live candle, EMAs and bid/ask lines move smoothly but no faster than ≈ 4 times per second; (2) switch to another tab for 10 s and come back → the candle jumps to the current price within 250 ms and keeps moving; (3) change symbol → no stale candle from the previous one.
- **Outcome:** 🕐 pending the user's manual check.
- **Est vs Actual:** 1 SP · 0.5 SP.

## Task 2 · [frontend] `afterScaleChange()` + `DrawingTools.onScaleChange()`

- **Mechanism:** `npm run build` + eslint + manual.
- **Commands:** `npm run build` → ✓ built · `npx eslint src/features/chart/LightweightChart.tsx src/features/chart/DrawingTools.ts` → clean · grep `requestAnimationFrame` under `features/chart` → no loops left: one-shot uses (input focus, error boundary retry, slot loading), the coalesced interaction check and the tick scheduler.
- **Implementation:** the 60 fps effect became `afterScaleChange` (same two signature checks, signatures in refs, then `trendlineManagerRef.current?.onScaleChange()`), called from `applyPending`, the visible-range handler, the `ResizeObserver`, `fitPrice` and a passive `pointermove` (buttons pressed) / `pointerup` / `wheel` / `touchmove` / `touchend` listener on the container coalesced to one frame. `DrawingManager` lost `rafId` / `scheduleRaf`; `onScaleChange()` repaints when the anchor Y moved more than 0.5 px and `resetScaleAnchor()` (the former `scheduleRaf` call sites) forces the next repaint.
- **Manual steps (user):** folded into the production validation of task 4: position labels, alert markers, drawings and the ruler follow scroll, zoom, price-axis drag and resize; DevTools Performance shows no periodic activity with no ticks (weekend) or with the tab idle.
- **Outcome:** 🕐 build and lint pass; manual check in task 4.
- **Est vs Actual:** 1.25 SP · 0.75 SP.

## Task 3 · [frontend] `drawRollovers` snapping by binary search

- **Mechanism:** `npm run build` + eslint + manual (lines identical before/after).
- **Commands:** `npm run build` → ✓ built · `npx eslint src/features/chart/LightweightChart.tsx` → clean · equivalence script (scratchpad, node): old scan vs new lower bound over 300 random sorted candle sets (M5 to D1 steps, 10 % gaps, weekend bars included) × 200 target times each = 60 000 checks → 0 mismatches.
- **Implementation:** `weekdayTimes` built once per repaint; `snapToCandle` is a lower-bound binary search returning the first weekday candle time ≥ target, or null past the end — the same result the scan produced.
- **Manual steps (user):** folded into task 4: rollover, weekly and month-start lines look the same on M5, H1, H4 and D1.
- **Outcome:** 🕐 build, lint and equivalence pass; visual check in task 4.
- **Est vs Actual:** 0.5 SP · 0.25 SP.

## Task 4 · [infra] Push, frontend deploy and production validation

- **Mechanism:** manual (user validation) + 10 s idle profile.
- **Deploy:** `da931c0` pushed 2026-11-11; production served `index-Cxz6PkRd.js` (Build 259.228.35) a few minutes later.
- **Profile (AC 7)**, same recording as the morning one (chart page, one pair, 3 EMAs, alerts and drawings, 10 s idle, DevTools Performance Bottom-up):

  | Activity | 2026-11-11 before | after |
  |---|---|---|
  | Paint (self) | 3 938 ms | below 10 ms (not in the list) |
  | Animation frame fired (self / total) | 137 / 3 164 ms | 65 / 2 040 ms, of which 1 211 ms belong to a browser extension (`quickpro-worker-page`, `toBlob`) |
  | Main thread busy | ≈ 8.3 s | ≈ 3.0 s (≈ 1.7 s without the extension) |

  Both figures are far below one third of the previous ones. The periodic CPU spikes left in the recording come from the extension, not from the app.
- **User validation on production:** ✅ 2026-11-11 — live candle and EMAs, labels / markers / drawings on scroll, zoom and axis drag, rollover lines, tab hidden and back, split view and mobile all as before ("buenísimo... funciona").
- **Est vs Actual:** 0.5 SP · 0.5 SP.

## Task 5 · [specs] Close

- **Final build:** frontend `npm run build` → ✓ built (2026-11-11).
- **Est vs Actual per task:** 1: 1 · 0.5 — 2: 1.25 · 0.75 — 3: 0.5 · 0.25 — 4: 0.5 · 0.5 — 5: 0.25 · 0.25.
- **Total:** 3.5 SP estimated · 2.25 SP actual. Calibration: the design had already located the loops and the call sites, so the three code tasks were mostly mechanical; same pattern as spec 041.
- **Deviations:** none. The local manual checks of tasks 1-3 were folded into the production validation by the user's choice.
- **Pending on the user:** nothing. Follow-up ideas outside this spec: fewer canvas layers, or disabling the third-party extension while trading.
- **Est vs Actual:** 0.25 SP · 0.25 SP.
