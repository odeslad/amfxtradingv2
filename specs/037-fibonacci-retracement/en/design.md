# 037 — Fibonacci retracement tool · Design

## Approach

Two parts: the drawing itself (frontend only) and the level set, chosen in Settings > Display and stored with the other display settings (db + backend + frontend).

The Fibonacci is one more `kind` in the drawing list of `DrawingManager` (`frontend/src/features/chart/DrawingTools.ts`): a two-anchor drawing like the trendline (`logical1/price1` → `logical2/price2`), persisted as `{ kind: 'fib', time1, price1, time2, price2, color? }` in the same JSON array the backend already stores opaquely (`PUT /drawings` only checks that `items` is an array, so no backend or DB change and no migration). Every two-anchor behaviour the trendline already has (hit test on the handles and the anchor segment, drag of one anchor or of the whole drawing, Ctrl + drag duplicate, Delete, lock, double-click colour cycle, persistence by time) is reused by widening the `line` branches to `line | fib`; only the painting and the hit-test surface are new.

The levels are computed at paint time from the two anchor prices: `price = price2 + (price1 − price2) × ratio` for every ratio enabled in Settings (default `{0, 0.236, 0.382, 0.5, 0.618, 0.786, 1}`; extensions above 1 fall past the first anchor by the same formula), so level 0 sits on the second click and 100 on the first (AC 1) and the direction of the swing is implicit in the click order. Each level is a horizontal segment from the leftmost anchor's x to the rightmost anchor's x (AC 2, as amended), the anchors are joined by a dashed segment, and the label `61.8  1.08432` sits at the left end of each level above the line.

## Alternatives

- **Separate `FibonacciManager` with its own canvas**: isolates the new code but duplicates selection, drag, persistence, lock and keyboard handling and needs a second z-order and a second `/drawings` payload. Rejected: the point of the spec is that the Fibonacci behaves exactly like the other drawings.
- **Levels as `lightweight-charts` price lines**: free labels on the price axis, but price lines span the whole chart width (contradicts AC 2), cannot be dragged as one object and do not live in the drawing list. Rejected.
- **Levels stored per drawing**: lets two Fibonaccis differ, but every existing drawing would need a migration path and the Settings toggles would not apply to them. Rejected: the set is global, like the trendline appearance, and the drawing stores only its two anchors.
- **Free-text ratios**: more flexible, but needs validation UI and ordering rules. Rejected in favour of a fixed catalogue with toggles, the pattern Setup levels already uses.

## Per-layer changes

### db

**`backend/prisma/schema.prisma`** · `SettingsDisplay` gains `fibLevels Float[] @default([0, 23.6, 38.2, 50, 61.8, 78.6, 100])` (percent values, the catalogue keys). Hand-written migration `20261106000000_fib_levels`:

```sql
ALTER TABLE "settings_display" ADD COLUMN "fibLevels" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[0,23.6,38.2,50,61.8,78.6,100]::DOUBLE PRECISION[];
```

### backend

**`src/routes/settings.ts`** · `FIB_LEVEL_CATALOGUE = [0, 23.6, 38.2, 50, 61.8, 78.6, 100, 127.2, 161.8, 200, 261.8]`; `parseFibLevels` mirrors `parseSetupLevels`: array of numbers from the catalogue, deduplicated, canonical order, `0` and `100` forced in. `DisplayInput` / `DisplayRow` / `toResponse` / upsert gain `fibLevels`. Older frontend builds never send the field, so nothing changes for them.

### frontend

**`features/chart/DrawingTools.ts`**
- `DrawingKind` gains `'fib'`; new `FibDrawing` / `PersistedFib` interfaces with the trendline's fields (`logical1/price1/logical2/price2`, optional `color`).
- `TrendlineAppearance` gains `fibLevels?: number[]` (percent values from Settings; default `[0, 23.6, 38.2, 50, 61.8, 78.6, 100]`), so the set reaches every `DrawingManager` through the existing `setAppearance` path and a change in Settings redraws every chart. `FIB_KEY_LEVELS = new Set([50, 61.8])`; `FIB_LABEL_FONT = '9px "DM Mono", monospace'` (the rectangle price font) and the existing `TEXT_COLOR` for key levels, `--muted`-like `#8c8c8c` text for the rest.
- `segPixels`, `hitTest`, `handleMove` (`start` / `end` / move), `handleDown` (two-click creation and Ctrl-duplicate), `handleDoubleAt` (colour cycle), `toPersisted`, `applyPersisted`, `loadPersisted`: every `d.kind === 'line'` branch that is about two anchors becomes `line | fib`. Shift-to-horizontal stays trendline-only.
- `hitTest` for `fib`: anchors first (`start` / `end` handles), then the dashed anchor segment, then each level segment (`distToSegment` against the horizontal span), all returning `line` as the body handle so the existing move code applies.
- New `paintFib(d, selected, preview)`: computes the level prices, draws each level as a horizontal segment in the drawing's colour (`d.color ?? appearance.color`), width and dash from `appearance` (AC 7), the 50 % and 61.8 % levels always solid, the anchor segment dashed `[4, 4]` at the same colour with 0.6 alpha, then the labels (`pct.toFixed(1) + '  ' + price.toFixed(decimals)`, decimals from `pipSize` as `paintRectPrices` does) with the black outline used by the rectangle labels; handles on both anchors when selected or previewing.
- `redraw`: the preview branch paints a `fib` from `drawStart` to the cursor exactly as the committed shape (same rule as line / rect).
- `scheduleRaf` anchor price: unchanged (`price1` exists on the fib).

**`features/chart/LightweightChart.tsx`**
- `DrawMode` gains `'fib'`; `drawModeToKind` maps it to `{ kind: 'fib' }`.

**`features/chart/ChartToolbar.tsx`**
- `DRAW_TOOLS` gains `{ mode: 'fib', title: 'Fibonacci retracement (two clicks, Ctrl+drag = duplicate, Del = delete)', label: 'Fibonacci', icon: <IconFib size={16} /> }` right after the rectangle, so it is in the desktop group and in the mobile Draw row (AC 6) with no further change.

**`shared/ui/icons.tsx`**
- `IconFib`: 16 px, same 1.2 stroke as `IconTrendline`: three horizontal lines of decreasing length (`y = 4, 8, 12`) and a thin diagonal from bottom-left to top-right.

**`features/settings/DisplayTab.tsx`** · `DisplaySettingsForm` gains `fibLevels: number[]`; new group "Fibonacci levels" after "Rectangle labels" (mockup): a `levelGrid` of `levelCard`s, one per catalogue entry, label `61.8 %` and a toggle; the `0` and `100` cards are on and disabled. `SettingsPage.tsx` adds the field to `DEFAULT_DISPLAY` and to the `/settings` payload; `ChartPage.tsx` reads `display.fibLevels` into `trendlineAppearance`.

**Split view (AC 5)**: each `ChartSlot` owns its `DrawingManager`, `drawMode` and `/drawings` payload (spec 036), so nothing to add.

**Older builds (AC 4)**: `loadPersisted` in the deployed bundle only branches on `marker | symbol | text` vs. "else two anchors", so an item with `kind: 'fib'` would be loaded as a two-anchor drawing and painted as a line. It does not crash; it is drawn as a trendline until the user refreshes to the new build. Acceptable for a frontend-only deploy where both builds never coexist for long.

## Data flow

Drawing: `DrawingManager.getPersisted()` → debounced `PUT /drawings` → `Drawing.items` JSON (unchanged) → `GET /drawings` → `loadPersisted`.

Levels: Settings > Display → `PUT /settings { display: { fibLevels } }` → `settings_display.fibLevels` → `GET /settings` on the Chart page → `trendlineAppearance.fibLevels` → `setAppearance` → `redraw`.

## Risks

- **Label clutter on small swings**: seven labels within a few pixels. Mitigation: when two consecutive levels are closer than 12 px, only the key levels (0, 50, 61.8, 100) keep their label; the lines are still drawn.
- **Hit testing seven horizontal segments per Fibonacci** on every `mousemove`: trivial cost against the existing per-drawing loop.
- **`color` cycling** reuses the line palette (default → red → green); the key levels keep the bright text colour in every case.

## Mockup

Approved by the user on 2026-11-06: https://claude.ai/artifact/4wZvwzaDDSCtwAwKnUaywj

Artboards:
- Desktop · Fibonacci drawn and selected — levels 0 to 100 between the two anchors, 50 % and 61.8 % solid with bright labels, the rest dashed in grey; dashed anchor segment; orange handles; Delete / Clear all; Fibonacci tool active in the toolbar after the rectangle.
- Desktop · after the first click — the preview follows the cursor with grey handles and the crosshair.
- Mobile · Draw row open with the Fibonacci tool active and the same drawing.
- Desktop · Settings > Display · Fibonacci levels group — eleven level cards with toggles, 0 and 100 on and dimmed, the default seven on.
