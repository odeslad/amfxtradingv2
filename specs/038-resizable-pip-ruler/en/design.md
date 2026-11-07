# 038 — Resizable pip ruler · Design

## Approach

The ruler stays outside the `drawings` list (never persisted, never counted) but becomes a first-class selectable object inside `DrawingManager`: the four scattered fields `rulerStart` / `rulerEnd` / `rulerFixed` / `isRulerMode` are replaced by one `ruler: TwoAnchor | null` (`logical1/price1/logical2/price2`, same shape as a trendline) plus the existing `isRulerMode` flag for the measuring phase. Selection reuses `selectedId` with the reserved id `'ruler'`, so `deleteSelected`, `setLocked`, the Delete button and `hasSelection` work without a parallel state. Hit testing, dragging and the touch press-drag-release come from the two-anchor code paths of spec 037 by treating the ruler as one more candidate before the drawings loop.

## Alternatives

- **Make the ruler a `kind` in `drawings`** and filter it out of `getPersisted` / `notifyCount`: least new code, but every consumer of `drawings` (RAF anchor, clear-all, count, persistence snapshot on `setCandleIndex`) needs an exception, and a timeframe switch would try to re-anchor it by time. Rejected: a separate field is simpler to reason about and matches "ephemeral".
- **Keep the ruler ephemeral and unselectable but allow a third click to re-measure**: no drag code, but does not meet AC 2. Rejected.

## Per-layer changes

### frontend

**`features/chart/DrawingTools.ts`**
- State: `private ruler: TwoAnchor | null = null` (`type TwoAnchor = { logical1; price1; logical2; price2 }`); `isRulerMode` kept; `rulerStart` / `rulerEnd` / `rulerFixed` removed. `const RULER_ID = 'ruler'`.
- **Measuring** (`handleDown`, ruler branch): first click → `drawStart` + preview (as the two-anchor tools, so the touch press-drag-release of 037 applies: `commitSecondAnchor` gains a ruler branch); second click → `ruler = {…}`, `isRulerMode = false`, `setSelected(RULER_ID)`, `onDone`. Measuring again replaces `ruler`.
- **Hit test**: before the drawings loop, if `ruler` exists: handles (`start` / `end`), then the diagonal (`distToSegment`) and the box edges / interior (`onRectEdge` or inside the rect) → `line` (body). Returns `{ id: RULER_ID, handle }`.
- **Drag** (`handleMove`): the `selectedId === RULER_ID` branch targets `ruler` instead of a drawing: `start` / `end` move one anchor, `line` shifts both by the delta. Ctrl + drag duplicate is skipped for the ruler (out of scope); `handleDoubleAt` ignores it.
- **Selection / removal**: `setSelected(null)` on an empty click keeps the ruler on screen (AC 3). `deleteSelected` removes `ruler` when it is the selection. `clearAll` also clears the ruler. `onKeyDown`: Escape clears the ruler (measuring or not); Delete / Backspace go through `deleteSelected`. `setLocked(true)` deselects but keeps it (AC 4).
- **Reset on dataset change**: `loadPersisted` (called on timeframe / symbol / broker change and on reload) clears `ruler`; `setCandleIndex` does not touch it (same chart, more history).
- **Paint**: `paintRuler` draws from `ruler` (or from `drawStart` + cursor during the preview, same code path), then handles on both ends when `selectedId === RULER_ID` (orange) or during the preview (grey).
- **Counts**: `notifyCount` keeps counting `drawings.length` only (AC 6); `scheduleRaf` keeps the ruler among its "something to repaint" conditions, with `ruler.price1` as the anchor price when there are no drawings.
- Public API unchanged: `startRuler`, `stopDrawing`, `deleteSelected`, `clearAll`, `hasSelection`.

**`features/chart/LightweightChart.tsx`** · no change: the Delete button already calls `deleteSelected` and shows on `hasSelection`; `clearAll` already clears everything.

## Data flow

Frontend only, in memory. The ruler never reaches `/drawings`.

## Risks

- **Hit priority**: a ruler drawn over a rectangle shares pixels with it; the ruler is tested first so a selected measurement is always grabbable. Acceptable: it is temporary.
- **Timeframe switch**: today the ruler survives a switch in logical space (wrong positions); clearing it on `loadPersisted` is a behaviour change the requirements ask for (AC 3).

## Mockup

Approved by the user on 2026-11-07: https://claude.ai/artifact/YZMvnWN3piRDRropW9mtiQ

Artboards:
- Desktop · pip ruler measured and selected — green box, diagonal, `pips · bars · %` badge, orange handle on each end; Ruler tool active in the toolbar.
- Mobile · pip ruler selected after press-drag-release.
