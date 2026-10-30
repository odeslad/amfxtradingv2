# 034 — Chart lock · Design

## Approach
A single `locked` boolean owned by `ChartPage`, stored in `localStorage` (`chart.locked`), passed to the toolbar (button) and to `LightweightChart`, which forwards it to `DrawingTools`. Every pointer handler that today grabs drawings, levels or alerts checks the flag first and lets the event through to lightweight-charts, which keeps zoom / pan as usual. Nothing is hidden and nothing changes in the backend.

## Frontend changes

### `ChartPage.tsx`
- `const [locked, setLocked] = useLocalStorage('chart.locked', false)` — the existing hook already used for `chart.selection`.
- `toggleLock` flips it; `toggleDrawMode` sets `locked` to `false` before entering a tool (AC 6).
- Passes `locked` / `onToggleLock` to `ChartToolbar` and `locked` to `LightweightChart`.

### `ChartToolbar.tsx` + `shared/ui/icons.tsx`
- New `IconLock` / `IconUnlock` (same 16px stroke style as the other icons).
- New icon button right after the alerts bell, `iconBtnActive` when locked; `title` / `aria-label` "Lock drawings, positions and alerts" / "Unlock …". On mobile it stays in the main row (not inside Draw).

### `LightweightChart.tsx`
- New prop `locked`, mirrored in `lockedRef` (declared before the effects, as in spec 032).
- SL/TP/alert drag (`startDrag`): when locked return `false` without selecting, so the event reaches the chart (AC 3, AC 4). When the lock turns on, clear `selectedLevel` and end any drag in progress.
- Position labels (entry / SL / TP HTML labels): when locked they get a `.positionLabelLocked` class with `pointer-events: none` — no double-click edit, no ✕ close button (hidden), and the gesture goes through to the chart.
- Calls `drawingTools.setLocked(locked)` when the prop changes.

### `DrawingTools.ts`
- `private locked = false;` plus `setLocked(value)`: stores it, deselects the current drawing, closes the text input, redraws.
- `handleDown` step 2 (hit-test / select / drag / Ctrl-duplicate): skipped when locked (`return false`) — drawing mode and ruler stay unaffected because the page unlocks before entering them (AC 6).
- `onDblClick` (text edit) and `onKeyDown` Delete / Backspace: no-op when locked (AC 7).

### Styles
- `LightweightChart.module.css`: `.positionLabelLocked { pointer-events: none; }` and hidden close button inside it.
- No new design tokens: the button reuses `iconBtn` / `iconBtnActive`.

## Data flow
`localStorage` ↔ `ChartPage.locked` → `ChartToolbar` (button) · `LightweightChart` (`lockedRef`) → `DrawingTools.setLocked`.

## Alternatives considered
- **Disable `pointer-events` on a whole overlay layer**: simpler, but the drawings and the levels are painted on the chart canvas itself and their hit-tests run on document-level listeners, so a CSS switch would not cover them.
- **Persist in Settings (DB)**: syncs devices, but needs a migration and backend changes; rejected by the user (browser only).

## Risks
- A drag already in progress when the lock is pressed: handled by ending it (`endDrag(false)`), the level returns to its start price.
- Spec 028 alerts: dragging alerts uses the same `startDrag`, so one guard covers both.

## Mockup
Approved: https://claude.ai/artifact/9DFF5pZe396vZDrLefrwHE

Artboards: Desktop · lock off · Desktop · lock on · Mobile · lock off · Mobile · lock on.

Deviation agreed during validation: on mobile the lock pushed Draw to a second row, so the Indicators button moved into the Draw row (mobile only; desktop unchanged).
