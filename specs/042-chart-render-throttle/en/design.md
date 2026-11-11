# 042 — Chart render throttle · Design

> Status: **closed**

## Approach

Three changes inside `features/chart`, all behind the same idea: **paint on events, never on a timer**.

1. **Tick coalescing** in `LightweightChart.updateLive`: the tick is stored as pending and applied by a single scheduler that runs at most once per animation frame and no more often than every 250 ms. The latest tick wins.
2. **Scale-change hook instead of polling**: the 60 fps loops in `LightweightChart` and `DrawingTools` are replaced by one function, `afterScaleChange()`, called from the places where the price scale can actually move: after a tick is applied, on `visibleLogicalRangeChange`, on resize, and on pointer / wheel interaction with the pane (price-scale drag has no event in lightweight-charts). It runs the same signature comparisons the loops run today, so labels, alert markers and drawings move exactly when they moved before.
3. **Cheaper overlay**: `drawRollovers` builds a sorted array of weekday candle times once per repaint and snaps each line by binary search; the alert markers and EMA cross trades are painted in the same pass as today.

Plus **visibility gating**: while `document.hidden`, pending ticks are kept but nothing is scheduled; on `visibilitychange` to visible the pending tick is applied.

No visual change: no mockup for this spec.

## Changes in `LightweightChart.tsx`

**Scheduler (new, inside the component)**
```ts
const pendingRef = useRef<{ candle: Candle; ask?: number } | null>(null);
const lastApplyRef = useRef(0);          // performance.now() of the last apply
const applyTimerRef = useRef<number | null>(null);   // rAF id or setTimeout id
const LIVE_MIN_INTERVAL_MS = 250;
```
- `updateLive(candle, ask)`: `null` resets as today (immediately). Otherwise `quoteRef` is updated at once (spread lines read it when they repaint) and the tick goes to `pendingRef`; `scheduleApply()`.
- `scheduleApply()`: no-op if a timer is already set or `document.hidden`. If `now - lastApply >= 250` → `requestAnimationFrame(applyPending)`; else `setTimeout(() => requestAnimationFrame(applyPending), remaining)`.
- `applyPending()`: clears the timer, takes the pending tick, runs the current body of `updateLive` (candle `series.update`, `updateLiveEmas`, `syncSpreadLines` when the spread is on), sets `lastApply`, then `afterScaleChange()`.
- `visibilitychange` listener: on visible, `scheduleApply()` if something is pending.
- Unmount: cancel the timer.

**`afterScaleChange()`** (replaces the loop at lines 402-435)
- Same two signature checks (position label Y's → `repositionLabels`; alert marker Y's + selected id → `drawRollovers`), with `lastSig` / `lastAlertSig` kept in refs.
- Then `trendlineManagerRef.current?.onScaleChange()` (below).
- Called from: `applyPending`; `subscribeVisibleLogicalRangeChange` (next to the existing `drawRollovers`, which it now subsumes: the range handler calls `drawRollovers` unconditionally today because the X positions change; keep that and let `afterScaleChange` skip its own repaint when the alert signature did not change); `ResizeObserver`; and a passive `pointermove` (only while a button is pressed) / `pointerup` / `wheel` listener on the container that schedules one `afterScaleChange` on the next frame (coalesced with a single rAF id). Also from the effects that change `positionLevelsRef` and `alertsRef` (they already call `repositionLabels` / `drawRollovers`; they reset the signatures).

**`drawRollovers`**
- `const weekdayTimes = data.filter(c => !isWeekend(c.time)).map(c => c.time)` once; `snapToCandle` becomes a lower-bound binary search over it. Weekend filtering and "snap forward" semantics unchanged. The rollover and month-start computations stay as they are (they are cheap compared with the scan).

## Changes in `DrawingTools.ts`

- `scheduleRaf()` and `rafId` go away. New public `onScaleChange()`: computes the anchor Y as `safeCoord()` does and calls `redraw()` only when it moved more than 0.5 px (same threshold), keeping `lastY` as a field. The constructor and every former `scheduleRaf()` call site (after add / remove / load of drawings and the ruler) now just reset `lastY` so the next `onScaleChange` repaints.
- `destroy()` no longer cancels a frame.

## Rate math

Today, per chart with 3 EMAs: 10 ticks/s × (1 candle + 3 EMA updates) = 40 lightweight-charts repaints/s, plus up to 10 overlay repaints/s from the loop, plus 60 signature passes/s. After: ≤ 4 applies/s → ≤ 16 lightweight-charts repaints/s (the library batches updates issued in the same task, so likely 4), overlay repaints only when an alert marker moved a whole pixel, zero idle work.

## Files to touch

| Layer | File | Change |
|---|---|---|
| frontend | `src/features/chart/LightweightChart.tsx` | scheduler, `afterScaleChange`, listeners, binary-search snap |
| frontend | `src/features/chart/DrawingTools.ts` | `onScaleChange()` replaces the rAF loop |

No new dependency, no backend change.

## Verification

- Build + eslint per task.
- **Profile**: the same 10 s idle recording on production (DevTools > Performance, chart page, one pair, 3 EMAs, a few alerts and drawings on screen) before/after; Bottom-up self time of Paint and "Animation frame fired" go to `verification.md` (AC 7: each under one third of 3 937 ms / 3 164 ms).
- **Idle check** (AC 2): with no ticks (weekend or `FEATURE_WS_BROADCAST` off locally) the Performance tab shows no periodic activity from the page.
- **Manual behaviour** (AC 1, 3-6): live candle and EMAs move; alerts panel, position labels, alert markers, drawings and ruler follow the scale on scroll / zoom / price-axis drag / resize; spread lines follow the quote; tab hidden → nothing; tab visible → chart catches up within 250 ms; split view.

## Risks

- **Price-scale drag with no event**: covered by the pointer / wheel listeners; if a case slips through (keyboard, programmatic autoscale after a double-click on the axis) the next tick corrects it within 250 ms. `fitPrice` (double-click handler) calls `afterScaleChange` explicitly.
- **Perceived latency**: a tick can wait up to 250 ms before painting. On M5 and above this is invisible; the alerts panel price (`ChartPage`) is not throttled, it comes straight from the WebSocket handler as today.
- **Spread lines**: they are price lines of the series and repaint with the candle; moving them out of the scheduler would reintroduce repaints, so they ride on the same 250 ms cadence.

## Alternatives considered

- **Throttle in `ChartSlot` before calling `updateLive`**: simpler, but the signature checks and the drawings would still need the scale hook, and the chart would not know when a tick was applied. Rejected: the scheduler belongs with the chart.
- **Keep the loop but at 10 fps**: cuts the idle cost by 6× but not to zero, and still repaints the overlay on every tick. Rejected.
- **Drop the alert-marker overlay repaint by drawing markers with lightweight-charts primitives**: cleaner long term, larger change, visual risk. Out of scope.
