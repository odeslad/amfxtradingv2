# 036 — Chart split view

> Status: **approved**

## Context
The Chart section shows one chart of the selected broker and symbol, with a timeframe row (M5 · M15 · H1 · H4 · D1) and a toolbar (indicators, alerts, lock, drawing tools, fullscreen…). To compare two timeframes of the same pair the trader has to switch back and forth, losing the view each time. There is no way to see two timeframes at once.

## Affected layers
- frontend

## User stories
- As a trader, I want a split button on the chart that opens a second chart next to the first, so that I can watch two timeframes of the same pair at the same time.
- As a trader, I want each chart to have its own timeframe row and toolbar, so that I can work on either one (draw, set alerts, lock, fullscreen) without the other changing.
- As a trader, I want the split and the two timeframes to be remembered in my browser, so that the chart opens as I left it.

## Acceptance criteria
- AC 1. WHEN the user clicks the split button in the chart toolbar on desktop THEN the chart area is divided into two charts side by side, half the width each by default, both showing the current broker and symbol; the left chart keeps its timeframe, view, drawings and indicators, and the right chart opens on the next timeframe up (H1 → H4; D1 → H1).
- AC 2. WHEN the split is on THEN each chart has its own timeframe row and its own full toolbar, and every toolbar action (timeframe, positions, alerts, lock, drawing tools, ruler, text, fullscreen) applies only to the chart it belongs to. Indicators (EMAs) and filters stay shared: both charts show the same EMAs, and the indicators button of either chart edits that common set.
- AC 3. WHEN the user changes the broker or the symbol THEN both charts change together; each keeps its own timeframe.
- AC 4. WHEN the split is on THEN both charts receive live ticks, the live candle, closed candles, positions, orders, alerts and drawings exactly as the single chart does today, each for its own timeframe.
- AC 5. WHEN the user clicks the split button again, in either chart, THEN the split closes and the chart whose button was clicked remains: from the left one, the left chart keeps its timeframe; from the right one, the single chart takes the right chart's timeframe. WHEN the split is opened again THEN both charts come back with the timeframes and order they had when it was closed.
- AC 6. WHEN the user puts one chart in fullscreen THEN only that chart fills the screen; leaving fullscreen returns to the split.
- AC 7. WHEN the user opens a panel from a chart (New Trade from the chart, alert panel, position edit) THEN the panel is preselected with that chart's timeframe where today it uses the chart's timeframe.
- AC 8. WHEN the split is on THEN a vertical divider between the two charts can be dragged with the mouse to resize the columns; each chart keeps at least 25 % of the width and never less than what its toolbar needs (no toolbar button is ever clipped), and both charts re-render to their new size while dragging.
- AC 9. WHEN the user reloads the page or comes back to Chart in the same browser THEN the split state, the timeframe of each chart and the divider position are restored (stored in the browser, per device).
- AC 10. WHEN the viewport is mobile (≤ 768 px) THEN the split button is not shown and a single chart is displayed even if the split was on in a wider window; widening the window again restores the split.

## Out of scope
- Different brokers or symbols per chart.
- More than two charts, or a vertical (stacked) split on desktop.
- Indicators per chart (EMAs are a per-user setting today; a later spec may split them).
- Syncing the split state between devices (no backend / DB change).
- Synchronising the crosshair or the visible time range between the two charts.
