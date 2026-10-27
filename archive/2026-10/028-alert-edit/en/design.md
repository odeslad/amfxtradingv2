# 028 — Edit price alerts · Design

## Approach

Frontend only. The backend already supports it:

- `PUT /alerts/:id` (`backend/src/routes/alerts.ts`) is a partial update accepting `price` and `enabled`, and calls `refreshAlerts()` so the evaluator's in-memory cache picks up the new level at once.
- A triggered alert has `enabled: false` (the evaluator sets it when it fires). Sending `enabled: true` together with the price goes through the existing false → true branch, which clears `triggeredAt`. So AC 11 (re-arm on edit) is `PUT { price, enabled: true }` — no server change.
- `direction` is not sent, so it is kept (AC 12).

## Frontend changes

### 1. `lib/useAlerts.ts`
Add `updatePrice(id, price)` → `apiSend('/alerts/:id', 'PUT', { price, enabled: true })`, then refresh the list (same as `toggle`/`remove`).

### 2. Alerts panel (`features/chart/AlertsPanel.tsx` + `.module.css`)
- The price in each row becomes a `<button>` (`aria-label="Edit price"`). Clicking it sets `editingId`; only one row edits at a time.
- The editing row renders a second line: `<input inputMode="decimal">` (focused, value = current price), **Save** (primary) and **Cancel** (outlined). Enter = save, Esc = cancel. Header shows only the direction (`▲ CROSSES ABOVE`), no "editing" label. No helper text.
- Validation: `Number(value)` finite and > 0, else the input gets the error border and Save is a no-op (AC 8).
- On failure: toast error, row stays in edit mode with the typed value (the list itself never changed).
- Buttons: `.toggleBtn` → outlined orange, `.deleteBtn` → outlined red with the text "Delete", both 34 px, uppercase, `--tracking-wide`, hover fill at 15 % — same values as `PositionCard.module.css` `.editBtn`/`.closeBtn` (AC 9).
- Triggered row: opacity moves from the whole row to the symbol/broker block and price only (AC 10).
- The panel exposes `onStartEdit(id)` via a prop/ref so the mobile action bar's **Edit price** can open the panel already editing that alert.

### 3. Chart drag (`features/chart/LightweightChart.tsx`)
Reuse the existing SL/TP drag effect (two-step: select, then drag; capture-phase mouse/touch listeners; scroll/scale off while dragging) instead of a second effect — two capture listeners on the same container would fight over `stopPropagation`.

- `DraggableLevel` becomes a union: `{ kind: 'sl' | 'tp', … }` | `{ kind: 'alert', id, alertId, price, direction }`.
- `findHit` also walks the alert levels (built from the `alerts` prop of the current broker/symbol), hit zone = 6 px around the alert's Y across the pane plus the marker/label on the price axis.
- Alerts are painted on the overlay canvas (`drawAlertMarkers`), not as price lines. For `kind: 'alert'`:
  - selection/drag state is read by `drawAlertMarkers`: the selected/dragged alert draws a dashed orange line across the pane and its axis label in solid orange; the original price keeps a faint dashed line + struck-through label while dragging.
  - `applyDragPrice` stores the live price in `alertDragRef` and redraws the overlay; the floating label (`▲ 1.12415 · +22.6 pips`, desktop) or (`▲ 1.12415`, mobile — `matchMedia('(max-width: 768px)')`) is drawn on the canvas, right-aligned next to the price axis and vertically centred on the line. Pips via `pipSize(symbol)` from `journal/utils/position.ts`.
  - `endDrag` keeps the price optimistically (`pendingPriceRef`, same mechanism as SL/TP) and calls the new prop `onMoveAlert(alertId, price)`. Price rounded to `getPricePrecision(symbol)`.
  - Esc during a drag: new `keydown` listener active only while `dragStateRef.current` is set (scoped, not global) → restore the original price, end drag without saving (AC 4). Added for SL/TP too since it is the same code path — harmless and consistent.
- New prop `onSelectAlert(alertId | null)` so the page knows which alert is selected (mobile bar).

### 4. `ChartPage.tsx`
- `chartAlerts` carries `direction` too.
- `onMoveAlert` → `alerts.updatePrice`; on error toast + `refreshAlerts()` (the optimistic price is dropped when the list comes back unchanged, AC 13).
- Mobile only: when an alert is selected, render `AlertActionBar` (new, small component + CSS module) at the bottom of the chart: **Edit price** (primary; opens the Alerts panel editing that alert), **On/Off** (outlined orange), **Delete** (outlined red), 44 px touch targets (AC 6).

## Data flow

Chart drag / panel input → `useAlerts.updatePrice` → `PUT /alerts/:id { price, enabled: true }` → DB + `refreshAlerts()` (evaluator cache) → response → list refresh → chart markers and panel re-render.

## Files

- `frontend/src/lib/useAlerts.ts`
- `frontend/src/features/chart/AlertsPanel.tsx`, `AlertsPanel.module.css`
- `frontend/src/features/chart/LightweightChart.tsx`
- `frontend/src/features/chart/ChartPage.tsx`
- `frontend/src/features/chart/AlertActionBar.tsx`, `AlertActionBar.module.css` (new)

No DB, backend, EA or contract changes. No new dependencies.

## Alternatives considered

- **Separate drag hook for alerts**: cleaner file split, but duplicates the hit/drag/touch logic and the two capture listeners collide. Rejected.
- **Render alerts as lightweight-charts price lines** (like SL/TP) so `applyOptions({ price })` moves them: simpler drag, but changes how every alert looks today (full-width lines for all alerts) — not in the mockup. Rejected.

## Risks

- `LightweightChart.tsx` is already large; the union type keeps the alert branches small, but it grows further. Candidate for a later refactor (frontend audit).
- Hit zones of an alert and an SL/TP at almost the same price overlap: the closest one wins (existing rule).
- Touch: the first tap selects, so an accidental tap while panning only selects, never moves.
