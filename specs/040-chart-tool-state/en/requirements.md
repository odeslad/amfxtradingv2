# 040 — Chart tool state remembered per chart

> Status: **implementing**

## Context
The chart toolbar has several toggles. Some are already remembered in the browser (broker / symbol / timeframe in `chart.selection`, the split view, the lock and the EMA cross trades per chart side), but the **Positions** button (none → all → buys → sells, which also shows the pending orders) is plain React state: every page load starts at "none" and the trader has to cycle it again on each chart. The per-side keys are also scattered across `ChartSlot` (`LOCK_KEY`, `EMA_TRADES_KEY`), so every new toggle repeats the same wiring. The trader wants every toolbar tool to come back as they last left it, per chart.

## Affected layers
- frontend

## User stories
- As a trader, I want the Positions / orders button to come back as I left it when I open the chart again, so that I do not cycle it on every visit.
- As a trader, I want each chart of the split view to remember its own tools, so that the left and right charts keep their own setup.

## Acceptance criteria
- AC 1. WHEN the user changes the Positions mode (none / all / buys / sells) on a chart THEN the choice is stored in the browser for that chart side; WHEN the page is reloaded or the chart is opened later THEN the button and the positions / orders drawn on the chart come back in that mode.
- AC 2. WHEN the split view is on THEN the left and right charts remember their Positions mode, lock and EMA cross trades independently; closing and reopening the split restores the right chart's tools too.
- AC 3. WHEN the user changes broker, symbol or timeframe THEN the tool states are kept (they belong to the chart side, not to the selection).
- AC 4. The lock and the EMA cross trades keep working exactly as today and keep their current storage keys (`chart.locked`, `chart.locked.right`, `chart.emaTrades`, `chart.emaTrades.right`), so nothing already saved is lost; the Positions mode uses the same pattern (`chart.positions`, `chart.positions.right`).
- AC 5. WHEN a stored value is missing or invalid THEN the tool starts at its default (`none`, unlocked, overlay off) without error.
- AC 6. The active drawing tool, the pip ruler, the open panels (alerts, indicators, filters, New Trade) and fullscreen stay transient: they are not remembered.

## Out of scope
- Syncing the tool state across devices or storing it server side.
- Remembering the drawing tool, the panels or fullscreen.
- Any change to the toolbar layout or icons.
