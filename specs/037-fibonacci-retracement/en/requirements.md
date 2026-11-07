# 037 — Fibonacci retracement tool

> Status: **implementing**

## Context
The chart has a set of drawing tools (trendline, rectangle, pip ruler, markers, symbols, text) implemented on a canvas overlay in `DrawingTools.ts` and persisted per user, broker, symbol and timeframe as a JSON list through `GET/PUT /drawings`. The trader has no way to draw Fibonacci retracement levels over a swing: today they draw several horizontal lines by hand or read the levels from another platform.

## Affected layers
- frontend · backend · db

## User stories
- As a trader, I want a Fibonacci tool in the drawing toolbar that draws the retracement levels between two points I click, so that I can see the usual pullback levels of a swing on the chart.
- As a trader, I want to move and resize the Fibonacci like any other drawing and have it saved with the rest, so that it is still there when I come back to that chart.
- As a trader, I want the percentage and the price of each level next to the line, so that I can place entries, stops and targets on them without measuring.
- As a trader, I want to choose in Settings > Display which Fibonacci levels are drawn, so that the tool shows only the levels I trade.

## Acceptance criteria
- AC 1. WHEN the user picks the Fibonacci tool and clicks two points on the chart THEN a Fibonacci retracement is drawn between them: level 0 at the second point's price and level 100 at the first point's price, with the levels enabled in Settings > Display (by default 0 · 23.6 · 38.2 · 50 · 61.8 · 78.6 · 100) as horizontal lines. The preview follows the cursor after the first click, like the trendline and the rectangle; Escape cancels.
- AC 2. WHEN a Fibonacci is drawn THEN each level line spans from the leftmost anchor to the rightmost anchor, and a dashed segment joins the two anchors. Each level shows a label with its percentage and its price, at the left end of the line, in the chart's monospace label style.
- AC 3. WHEN the user clicks a Fibonacci THEN it is selected (handles on both anchors); WHEN it is selected THEN dragging an anchor moves that anchor and the levels follow, and dragging the anchor segment moves the whole drawing. The lock, Delete / Backspace, the delete and clear-all buttons, Ctrl + drag duplicate and double-click colour cycling (default → red → green) work as they do for a trendline.
- AC 4. WHEN the user changes timeframe, reloads the page or opens the chart on another device THEN the Fibonacci comes back on the same prices and times, persisted through the existing `/drawings` endpoint alongside the other drawings. Older frontend builds ignore the new item kind without breaking.
- AC 5. WHEN the chart is in split view THEN each chart has its own Fibonacci tool and its own drawings, as with every other drawing tool.
- AC 6. WHEN the viewport is mobile THEN the Fibonacci tool appears in the Draw row with the other tools and the two taps, drag and double-tap work as they do for the trendline. Press → drag → release also closes a two-anchor drawing (trendline, rectangle, Fibonacci) where the finger lifts; a plain tap keeps the two-tap flow.
- AC 7. WHEN the trader changes the trendline colour, style or width in Settings > Display THEN the Fibonacci level lines follow the same appearance; every level line and label looks the same (bright label text).
- AC 8. WHEN the trader opens Settings > Display THEN a Fibonacci levels group lists the catalogue 0 · 23.6 · 38.2 · 50 · 61.8 · 78.6 · 100 · 127.2 · 161.8 · 200 · 261.8 with a toggle each; 0 and 100 are always on (they are the anchors). WHEN the trader toggles a level and saves THEN every Fibonacci on every chart is redrawn with the new set, without touching the stored drawings. Levels above 100 extend past the first anchor in the direction of the swing.

## Out of scope
- Fans, arcs, time zones and custom ratios outside the catalogue.
- Per-level colours and per-drawing level sets: the set is global, like the trendline appearance.
- Alerts on Fibonacci levels.
