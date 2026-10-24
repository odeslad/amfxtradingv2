# 025 — Chart fixes: mobile toolbar, drawings and alerts panel

> Status: **approved**

## Context

On a phone the chart toolbar squeezes thirteen controls into one row: the timeframe select plus twelve
icon buttons (positions, alerts, trendline, rectangle, ruler, buy / sell markers, cross, check, text,
filters, indicators, fullscreen). Each icon ends up around 30 px wide and touching its neighbours, well
under the 44 px the rest of the mobile UI uses, so tapping the right tool is a lottery. Desktop is fine
and stays as it is. A second, unrelated defect rides along: the rollover lines drawn on the overlay
canvas are not clipped to the candle pane, so when the chart is scrolled to the right they paint over
the price scale. The most serious item is the closed-candle gap: closed candles only reach the database
through the `candles_<SYM>_<TF>.json` files the EA writes on its own cycle and the watcher polls every
30 s, so for up to a minute after a close neither the chart nor a reload has the last closed candle,
while the backend already holds its OHLC from the ticks.

## Affected layers

- backend · frontend

## User stories

- As an operator on the phone, I want the chart tools I use every day at finger size, so that I open
  positions, alerts, filters and fullscreen without mis-taps.
- As an operator on the phone, I want the drawing tools out of the way until I need them, so that the
  chart keeps its height while I only watch the price.
- As an operator, I want the candle that just closed on the chart the moment it closes, so that I act on
  the close without a blind minute.

## Acceptance criteria

- AC 1. WHEN the chart opens on a phone (max-width 768 px) THEN the toolbar shows one row with the
  timeframe select, the positions, alerts, filters, indicators and fullscreen buttons and a **Draw** button; every
  button is 44 px tall and at least 44 px wide, with 4 px between them.
- AC 2. WHEN the operator taps Draw THEN a second row opens under the first with the eight drawing
  tools (trendline, rectangle, ruler, buy marker, sell marker, cross, check, text) at the same sizes;
  the Draw button shows as active while the row is open; tapping it again closes the row.
- AC 3. WHEN a drawing tool is selected THEN it shows as active in the second row, the Draw button
  stays active, and the row stays open until the operator closes it or the drawing is finished; when
  the tool finishes (the existing `onDrawDone`) the row stays open so the next drawing is one tap away.
- AC 4. WHEN the second row is open THEN the chart area shrinks by the row's height, nothing overlaps
  the chart; when it closes the chart gets the height back.
- AC 5. WHEN the chart is in fullscreen on the phone THEN the same two-row toolbar applies.
- AC 6. WHEN the viewport is wider than 768 px THEN the toolbar is exactly as today (one row, every tool
  visible, no Draw button).
- AC 7. WHEN the operator rotates the phone or resizes past the breakpoint THEN the toolbar switches
  layout without losing the selected tool.
- AC 8. WHEN the chart is scrolled so that a rollover line (daily, weekly or month start) falls beyond
  the last candle THEN the line stops at the right edge of the candle pane and never paints over the
  price scale; on any device.
- AC 9. WHEN a rectangle is selected THEN it shows eight handles, one per corner and one at the middle of
  each edge, plus a cross at its centre: dragging a corner resizes freely (as today), dragging a side
  handle resizes only that edge (horizontal on the left / right handles, vertical on the top / bottom
  ones), and dragging the cross moves the whole rectangle keeping its size; the cursor reflects each
  action on desktop and the handles have a 44 px touch target on the phone.
- AC 10. WHEN a buy marker, sell marker, check or cross drawing is selected THEN it shows a 1 px orange
  (`--orange`) ring around it, with 4 px of clearance, so the selection is visible before dragging or
  deleting it; unselected markers look exactly as today.
- AC 11. WHEN a text label is selected THEN only its text turns orange (`--orange`), with no dotted frame
  around it; unselected labels keep their colour as today.
- AC 12. WHEN the alerts panel shows its "Add alert" and "Add EMA alert" buttons THEN they use the
  panel's primary submit style (48 px, `--orange` background, black uppercase text, no radius) like New
  Trade and the edit panels; the disabled / saving states keep the same style at reduced opacity.
- AC 13. WHEN the live candle moves THEN every EMA line extends to it with a provisional value computed
  from the last closed EMA and the live close, updated on every tick like the candle itself; when the
  candle closes the provisional point is replaced by the closed one with no jump, and the EMA lines
  never lag one candle behind the price.
- AC 14. WHEN a tick's `<tf>_time` advances for a symbol (the candle of that timeframe closed) THEN the
  backend writes that closed candle to `candles` at once, built from the last tick of the previous
  candle (open / high / low from the tick's `<tf>_*` fields, close = its bid), and broadcasts it over
  the WebSocket as `candle` with the broker at the root; the chart appends or replaces that candle
  immediately, and a reload within the gap already shows it. The EA's file keeps authority: when the
  watcher later reads it, its values overwrite the tick-built row.
- AC 15. WHEN a price alert is created, toggled, deleted or fires THEN its marker on the price scale
  appears, changes or disappears at once, without scrolling, zooming or changing the symbol.

## Out of scope

- Changes to the drawing tools other than the rectangle handles and the marker and text selection looks, the legend, the price scale or the
  chart's touch handling.
- The desktop toolbar.
- The Journal's and Settings' mobile layouts.
