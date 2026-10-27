# 028 — Edit price alerts

> Status: **closed**
> Mockup: [Edición de alertas](https://claude.ai/artifact/7LbhQNyWn6sAVVnpQWW19A) (approved)

## Context

Price alerts can today only be created, switched on/off and deleted. Moving an alert means deleting it and creating a new one. The backend `PUT /alerts/:id` already accepts a partial update (price included) and refreshes the evaluator's in-memory cache, but the frontend never sends a price and the chart only paints alerts as markers on the price axis, without any interaction.

## Affected layers

- frontend (backend only if the re-arm rule needs a server change — see design)

## User stories

- As a trader, I want to drag an alert up or down on the chart, so that I can move it to a new level without recreating it.
- As a trader, I want to type a new price for an alert in the Alerts panel, so that I can set an exact level.
- As a trader, I want the alert buttons to look like the Positions ones, so that the app is consistent.

## Acceptance criteria

**Chart (desktop and mobile)**
- AC 1. WHEN the user clicks/taps an alert's line or price-axis label THEN the alert is selected (dashed orange line across the chart).
- AC 2. WHEN the user presses and drags a selected alert up or down THEN the line follows the pointer and a label centred on the line, at the right edge next to the price axis, shows `▲/▼ <price> · <±pips>` (distance from the original price) on desktop and only `▲/▼ <price>` on mobile, without the word "alert".
- AC 3. WHEN the user releases the drag THEN the new price is saved, the line stays at the new price (optimistic) and the Alerts panel shows the new price.
- AC 4. WHEN the user presses Esc during a drag THEN the alert returns to its previous price and nothing is saved.
- AC 5. WHILE dragging, the chart does not pan or zoom.
- AC 6. WHEN an alert is selected on mobile THEN a bottom bar shows **Edit price**, **On/Off** and **Delete**.

**Alerts panel**
- AC 7. WHEN the user taps an alert's price in the list THEN that row opens an input with the current price plus **Save** and **Cancel**; Enter saves, Esc cancels. No helper text is shown.
- AC 8. WHEN the typed price is not a positive number THEN Save does nothing and the input shows the error state.
- AC 9. The row's On/Off button is outlined orange and Delete is outlined red, uppercase, 34 px high, like Edit/Close in Positions.
- AC 10. A triggered alert dims only its symbol and price; its buttons keep full contrast.

**Rules**
- AC 11. WHEN the price of a triggered or Off alert is changed (drag or input) THEN it is re-armed (On, triggered cleared).
- AC 12. WHEN the price is changed THEN the direction (crosses above/below) is kept.
- AC 13. WHEN saving fails THEN the alert goes back to its previous price and an error toast is shown.

## Out of scope

- Editing EMA-cross alerts.
- Changing broker, symbol or direction of an existing alert.
- Dragging alerts of a symbol other than the one on the chart.
