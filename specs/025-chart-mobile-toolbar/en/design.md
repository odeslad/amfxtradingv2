# 025 — Chart fixes · Design

## Approach

Nine independent fixes grouped by the file they touch, so each task is one coherent commit: the
backend's closed-candle feed, the chart's data path (candles, EMAs, overlay), the drawing tools, and the
toolbar plus alerts panel chrome. No new dependency, no schema change. The only cross-layer piece is the
new WebSocket message `candle`; the frontend ignores it until deployed and the backend sends it to
everyone, so deploy order backend → frontend is safe.

## Backend (AC 14)

`services/candle-close.ts` (new): `trackCandleCloses(broker, batch)` keeps, per `broker:symbol:tf`, the
last tick's `<tf>_time` / `<tf>_open` / `<tf>_high` / `<tf>_low` / `bid`. When a tick brings a different
`<tf>_time` for that key, the previous snapshot is the closed candle: `db.candle.upsert` on
`(broker, symbol, timeframe, time = new Date(prevTime))` with `create` = the OHLC (close = last bid) and
`update: {}` (an existing row, which can only come from the EA, is left alone), then
`wss.broadcastCandle(broker, { symbol, timeframe, time: prevTime / 1000, open, high, low, close })`.
Called from the `ticks` handler in `index.ts` next to the evaluators, independent of `FEATURE_ALERTS`,
gated by `FEATURE_WS_BROADCAST` only for the broadcast. The same five `TF_FIELDS` as the EMA evaluators.
The first tick after start only seeds the map (no candle without a full previous one).

`services/candles.ts` `upsertCandles`: the EA file keeps authority (AC 14). The closed list is still
inserted with `createMany({ skipDuplicates })`, and its last two candles are additionally written with
`upsert` + `update` of the OHLC, so a tick-built row is replaced by the EA's values on the next poll.
Two extra queries per file.

`ws/ws.ts`: `broadcastCandle(broker, candle)` → `broadcast('candle', { broker, ...candle })`. Docs:
`architecture.md` WS table and `.claude/CLAUDE.md` WS line gain `candle`.

Time base: `<tf>_time` arrives in ms on the broker-time base that `candles.time` already uses (the
EA's file gives seconds, stored as `new Date(sec * 1000)`), so `new Date(prevTime)` lands on the same
row the EA will write. A backend test (vitest) covers the tracker with a synthetic tick sequence.

## Frontend

### Chart data (AC 13, 8, 15) — `ChartPage.tsx`, `LightweightChart.tsx`

- **`candle` message**: in the WS handler of `ChartPage`, a `candle` for the current broker / symbol /
  timeframe → `setCandles(prev => upsertByTime(prev, parsed))` (replace the row with the same time, else
  append and keep order) and `liveCandleRef.current = null` when its time matches, so the chart's
  `candles` prop updates like a REST load. Parsing reuses the REST path's conversion of `time`.
- **EMA on the live candle**: `syncEmaSeries` keeps, per EMA id, the last closed point `{ time, value }`
  after `setData`. `updateLive` then calls `series.update({ time: liveTime, value: close * k +
  last.value * (1 - k) })` for every EMA with `k = 2 / (period + 1)`; `setData` on the next closed
  candle replaces it. No extra state in the page.
- **Rollover clipping**: `drawRollovers` wraps the line loop in `ctx.save(); ctx.beginPath();
  ctx.rect(0, 0, chart.timeScale().width(), bottom); ctx.clip(); … ctx.restore()`. Alert markers are
  drawn after the restore, at the pane edge as today.
- **Alert markers refresh**: the rAF loop computes the alert signature even when the list is empty (the
  `length > 0` guard made the last deletion invisible) and `alerts` changes also call
  `drawRolloversRef.current()` from the existing `alertsRef` effect.

### Drawing tools (AC 9, 10, 11) — `DrawingTools.ts`

- `Handle` gains `'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | 'move'`. For a rectangle the
  hit test checks, in order: the four corners (radius `r`), the four edge midpoints (`r`), the centre
  cross (`r`), then the edges (`'line'`, which keeps today's drag-to-move). Lines keep `start` / `end`.
- A rectangle is normalised on `endDrag` (`logical1 < logical2`, `price1 > price2`), so `nw` always
  means (logical1, price1), `e` moves `logical2`, `s` moves `price2`, etc. `n` / `s` change only the
  price, `e` / `w` only the logical; corners change both; `move` and `line` shift all four by the drag
  delta (as the current `dragLastLogical` path).
- Cursors on desktop: `nwse-resize` / `nesw-resize` for corners, `ns-resize` / `ew-resize` for sides,
  `move` for the cross and the edges, from the hover hit in `onMouseMove`.
- Paint: `paintRect` with `selected` draws the four corners with `paintHandle` (circles, as today) and
  the four midpoints as 8 px squares in `HANDLE_ACTIVE_COLOR`, plus a 20 px four-arrow cross at the
  centre; the preview while drawing keeps the two corners only.
- `paintMarker(p, direction, selected)` / `paintSymbol(p, variant, selected)`: when selected, a 1 px
  `HANDLE_ACTIVE_COLOR` `strokeRect` around the glyph's box with 4 px clearance.
- `paintText`: selected → `fillStyle = HANDLE_ACTIVE_COLOR`, no dashed frame.
- Touch: `HIT_RADIUS_TOUCH` stays 22 (a 44 px target); the new handles share it.

### Toolbar (AC 1–7) — `ChartToolbar.tsx` + `.module.css`

- Markup regrouped: `.tools` keeps the timeframe select and the five everyday buttons (positions,
  alerts, filters, indicators, fullscreen) plus a **Draw** toggle button (`.drawToggle`, text "Draw",
  `aria-expanded`); the eight drawing buttons move into `.drawTools`. On desktop `.drawToggle` is
  `display: none` and `.drawTools` renders inline in the same row (order preserved: after alerts, before
  filters, via CSS `order`), so the row is pixel-identical to today (AC 6).
- Mobile (`max-width: 768px`): `.toolbar` becomes `flex-wrap: wrap; height: auto; padding: 4px 8px`;
  `.tools` is the first row (`flex-basis: 100%`), `.drawTools` the second (`flex-basis: 100%`, hidden
  unless `drawOpen`); buttons 44 × 44 with 4 px gap, the select `flex: 1; min-width: 70px; height: 44px`.
- `drawOpen` is local state in `ChartToolbar` (initial `false`); it is not reset by `onDrawDone`
  (AC 3) and survives a resize (the state is independent of the breakpoint, AC 7). The chart area is
  `flex: 1` already, so a second row shrinks it (AC 4); fullscreen uses the same component (AC 5).

### Alerts panel (AC 12) — `AlertsPanel.module.css`

`.addBtn` restyled to the panel submit standard: `height: 48px; border: none; background:
var(--orange); color: #000; font: var(--text-md) var(--font-sans); letter-spacing:
var(--tracking-wide); text-transform: uppercase; border-radius: 0`; `:hover opacity .85`,
`:disabled opacity .4`. Mobile keeps `--text-xl` like the other panels.

### Files

```
backend/src/services/candle-close.ts (+ test)          new
backend/src/services/candles.ts, src/index.ts, src/ws/ws.ts, docs/architecture.md, .claude/CLAUDE.md   edit
frontend/src/features/chart/ChartPage.tsx, LightweightChart.tsx   edit
frontend/src/features/chart/DrawingTools.ts                        edit
frontend/src/features/chart/ChartToolbar.tsx (+ .module.css)       edit
frontend/src/features/chart/AlertsPanel.module.css                 edit
```

## Mockup

Design artifact approved by the user on 2026-10-24: https://claude.ai/artifact/66KKArTpvxsXetAAZsYpY1.
Artboards: Rectangle selected (eight handles and the centre cross), Chart · mobile toolbar (one row),
Chart · Draw row open (second row with the eight tools), Markers selected (the four markers and a text
label, unselected and selected), Alerts panel · Add button.

## Risks

- A tick-built candle's close is the last bid before the rollover, which can differ by fractions of a
  pip from the EA's close; the EA's file overwrites it within a poll. Accepted by the user.
- A backend restart loses the per-symbol snapshot, so the first close after a restart is not emitted
  (the EA file fills it as today).
- Rectangle normalisation changes the stored `logical1/2`, `price1/2` order of existing drawings only
  when they are next dragged; the persisted shape does not change.
