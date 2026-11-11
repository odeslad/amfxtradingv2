# 042 — Chart render throttle

> Status: **approved**

## Context

With the chart page open and idle, the browser's main thread is busy most of the time. A 10 s DevTools Performance profile on production (2026-11-11, after spec 041 cut the WebSocket volume) shows ≈ 3.9 s of Paint (47 %) and ≈ 3.2 s under "Animation frame fired" (38 %), the rest mostly lightweight-charts rendering; the user sees ≈ 25 % more CPU with the chart visible. Two causes in `features/chart`: (1) every tick (10 per second) applies the live candle and one update per EMA to lightweight-charts, each triggering a full chart repaint; (2) a permanent `requestAnimationFrame` loop in `LightweightChart` (and a second one in `DrawingTools` while drawings exist) runs 60 times per second computing price-to-pixel signatures for positions and alerts, and because the autoscaled price axis shifts a little on almost every tick, it repaints the whole overlay (rollover lines with a scan of all candles per line, alert markers, EMA cross trades) up to ten times per second. Split view doubles everything.

This spec makes the chart repaint only when something visible changed and at a bounded rate, with no visual change for the user.

## Affected layers

- frontend

## User stories

- As a trader, I want the chart page to stop burning CPU while it sits idle, so that my laptop stays cool and quiet and the battery lasts.
- As a trader, I want the live candle, the EMAs, the spread lines, the alert markers, the position labels and the EMA cross trades to look and move exactly as today, so that the optimisation is invisible.
- As a trader with the app in a background tab, I want it to do nothing until I come back, so that it does not compete with what I am doing.

## Acceptance criteria

- AC 1. WHEN ticks arrive for the chart pair THEN the live candle and the EMAs are applied to the chart at most once per animation frame and at most every 250 ms, with the latest tick's values; between applications the newer tick replaces the pending one.
- AC 2. WHEN the chart is idle (no tick, no scroll, no zoom, no resize, no user interaction) THEN no `requestAnimationFrame` callback of `features/chart` is scheduled and the overlay is not repainted.
- AC 3. WHEN a tick is applied, the visible range changes, or the container resizes THEN position labels and alert markers are re-positioned if, and only if, their pixel position changed, exactly as the current loop does.
- AC 4. WHEN drawings exist (trendlines, rectangles, Fibonacci, ruler) THEN they follow the price scale on those same events with no continuous loop.
- AC 5. WHEN the overlay needs a repaint THEN the rollover lines are computed from a time→candle index built once per repaint, not by scanning every candle per line, and the painted result is identical.
- AC 6. WHEN the browser tab is hidden THEN pending chart updates are dropped and nothing is painted; WHEN it becomes visible again THEN the next tick (or the last pending one) repaints the chart within one interval.
- AC 7. WHEN the same 10 s idle profile is recorded on production after the deploy THEN Paint and "Animation frame fired" are each below one third of the 2026-11-11 figures (≈ 1.3 s and ≈ 1.1 s), and the live candle, EMAs, spread, alerts, position labels, drawings and EMA cross trades behave as before on desktop and mobile, single and split view.

## Out of scope

- Reducing the number or size of the canvas layers (chart, scales, overlay, drawings).
- Changing lightweight-charts options or version.
- Throttling anything outside the chart page (positions, accounts, WebSocket volume: see spec 041).
- Any visual change.
