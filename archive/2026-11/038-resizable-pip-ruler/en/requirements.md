# 038 — Resizable pip ruler

> Status: **closed**

## Context
The chart's pip ruler (`DrawingTools.ts`) is a two-click measurement: the first click fixes the start, the second fixes the end, and the box with its `pips · bars · %` badge stays on screen until any later click clears it. It cannot be selected, moved or resized: a wrong second click means measuring again from scratch. The user wants it to feel like the Fibonacci tool shipped in spec 037 (handles, drag, press-drag-release on touch) while staying ephemeral: a measurement, not a drawing to keep. Follow-up of [037-fibonacci-retracement](../../../archive/2026-11/037-fibonacci-retracement/en/requirements.md).

## Affected layers
- frontend

## User stories
- As a trader, I want to adjust the ends of a pip ruler I just measured, so that I can correct a click without starting over.
- As a trader, I want to move the whole ruler to another swing, so that I can compare moves of the same size.
- As a trader, I want the ruler to stay a temporary measurement, so that it never clutters my saved drawings.

## Acceptance criteria
- AC 1. WHEN the user picks the ruler and clicks two points THEN the ruler is measured as today (box, dashed diagonal, `pips · bars · %` badge, green for an upward move and red for a downward one) and stays on screen **selected**, with a handle on each end.
- AC 2. WHEN the ruler is selected and the user drags a handle THEN that end moves and the box and badge are recomputed live; WHEN the user drags the box or the diagonal THEN the whole ruler moves keeping its size.
- AC 3. WHEN the user clicks on the chart away from the ruler THEN the ruler is deselected but stays on screen; WHEN the ruler is not selected and the user clicks it THEN it is selected again. Delete / Backspace while selected, Escape, Clear all, picking any drawing tool, a timeframe change, a symbol or broker change or a reload remove it. Measuring again replaces the previous ruler.
- AC 4. WHEN the chart is locked THEN the ruler ignores the pointer like the other drawings; the lock does not remove it.
- AC 5. WHEN the user presses, drags and releases on touch THEN the ruler is measured where the finger lifts (a plain tap keeps the two-tap flow, as for the other two-anchor tools); handle and body drags work by touch too.
- AC 6. The ruler is never sent to `/drawings`; the drawing count that shows the delete / clear-all buttons ignores it. The Delete button acts on the selected ruler when it is the selection.

## Out of scope
- Persisting the ruler or showing more than one at a time.
- Changing the badge content or colours.
- Ctrl + drag duplicate and double-click colour cycling for the ruler.
