# 034 — Chart lock

> Status: **draft**

## Context
On the chart, drawings (lines, rectangles, markers, symbols, texts), position and order lines (entry, SL, TP) and price alerts all react to the mouse. When the user zooms or pans the chart and the pointer starts over one of them, that element gets selected or dragged instead of the chart moving, and the user has to fix it afterwards. There is no way to make these elements ignore the mouse.

## Affected layers
- frontend

## User stories
- As a trader, I want a lock button on the chart, so that I can zoom and pan without accidentally moving drawings, positions, orders or alerts.
- As a trader, I want the lock to be remembered, so that I don't have to turn it on every time I open the chart.

## Acceptance criteria
- AC 1. WHEN the user clicks the lock button in the chart toolbar THEN the lock turns on and the button shows its active state; clicking it again turns it off.
- AC 2. WHEN the lock is on THEN clicking or dragging a drawing neither selects nor moves it, and the gesture zooms / pans the chart as if the drawing were not there.
- AC 3. WHEN the lock is on THEN the entry, SL and TP lines of positions and pending orders cannot be dragged or edited from the chart, and the gesture moves the chart.
- AC 4. WHEN the lock is on THEN price alerts cannot be dragged or edited from the chart, and the gesture moves the chart.
- AC 5. WHEN the lock is on THEN drawings, positions, orders and alerts stay visible and keep updating (live prices, new alerts).
- AC 6. WHEN the lock is on AND the user picks a drawing tool (or the ruler) THEN the lock turns off automatically and the tool works as usual.
- AC 7. WHEN the lock is on AND a drawing was selected THEN it is deselected, and Delete / Backspace do not delete anything.
- AC 8. WHEN the user reloads the page or reopens the chart in the same browser THEN the lock keeps the last state (stored in the browser, per device).
- AC 9. The button works on desktop and mobile (touch: tap and drag behave like click and drag).

## Out of scope
- Syncing the lock state between devices (no backend / DB change).
- Locking individual elements one by one.
- Hiding drawings or positions (visibility stays as today).
