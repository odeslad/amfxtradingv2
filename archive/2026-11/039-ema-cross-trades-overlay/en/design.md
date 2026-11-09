# 039 — EMA cross trades overlay · Design

## Approach

Three small pieces on top of what exists:

1. **Parameters** live in `SettingsDisplay` (five new columns) and travel through `/settings` like `fibLevels` (spec 037): one global group in Settings > Display.
2. **Setups** come from the backend: `detectEmaCrossSetups` already yields, per cross, the activation candle (`activationTime`, `ECC` = its close), the direction, the previous EVL of the fast EMA and the next opposite cross (`closeTime`). `GET /setup-levels` gains a `limit` and returns the last N setups instead of only the latest; the frontend adds the entry offset and the duration cap, which are display rules.
3. **Painting** goes on the chart's existing overlay canvas (`overlayRef` in `LightweightChart`, the one that already draws the rollover lines and the alert markers and repaints on every visible-range change). The trades are not drawings: `DrawingManager` is untouched, nothing goes to `/drawings`.

## Alternatives

- **Compute the crosses in the frontend** from the 2000 loaded candles and the chart's own EMA code: no backend change, but it duplicates `detectEmaCrossSetups` (EVL and setup-close rules) and the New Trade panel would show levels from one implementation and the overlay from another. Rejected: one implementation, server side.
- **Draw the levels as `lightweight-charts` price lines**: free axis labels, but price lines span the whole width and cannot start or end at a candle (AC 3). Rejected.
- **Make the trades a drawing kind**: they would be saved, selectable and counted, the opposite of AC 6. Rejected.

## Per-layer changes

### db

**`backend/prisma/schema.prisma`** · `SettingsDisplay` gains `emaTradesFast Int @default(24)`, `emaTradesSlow Int @default(48)`, `emaTradesEntryPips Float @default(5)`, `emaTradesHours Int @default(24)`, `emaTradesCount Int @default(3)`. Hand-written migration `20261108000000_ema_trades_settings`:

```sql
ALTER TABLE "settings_display"
  ADD COLUMN "emaTradesFast" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN "emaTradesSlow" INTEGER NOT NULL DEFAULT 48,
  ADD COLUMN "emaTradesEntryPips" DOUBLE PRECISION NOT NULL DEFAULT 5,
  ADD COLUMN "emaTradesHours" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN "emaTradesCount" INTEGER NOT NULL DEFAULT 3;
```

### backend

**`src/routes/settings.ts`** · `DisplayInput` / `DisplayRow` / `toResponse` / upsert gain an `emaTrades` object `{ fast, slow, entryPips, hours, count }` mapped to the five columns. Validation: `fast`, `slow` positive integers and different; `entryPips` finite ≥ 0; `hours` integer 1–720; `count` integer 1–10. Absent → stored value kept, as for the other display fields.

**`src/routes/setup-levels.ts`** · optional `limit` query (integer 1–10, default 1). The response keeps `setup` (the latest, unchanged for the New Trade panel) and adds `setups`: the last `limit` setups, oldest first, each `{ direction, activationTime, closeTime, levels: { ECC, EVL }, pipSize }`. `MAX_CANDLES` stays 1000 (enough for 10 H1 setups; D1 may return fewer, which AC 8 allows).

### frontend

**`features/settings/DisplayTab.tsx`** · `DisplaySettingsForm` gains `emaTrades: { fast, slow, entryPips, hours, count }`; new group "EMA cross trades" after "Fibonacci levels" (mockup): two-column rows with a numeric input each (fast EMA, slow EMA, entry offset in pips, max duration in hours, trades shown), spinners removed as the project rule asks. `SettingsPage.tsx` adds the defaults and sends the object inside `display`.

**`lib/useEmaTradesSettings.ts`** (new, same shape as `useDisplaySettings`) · reads `display.emaTrades` from `/settings` once; `ChartPage` passes it to both slots so a Save in Settings is picked up on the next load of the Chart page (the page already refetches `/settings` on mount; AC 7's "redraws" means after saving and returning to the chart, as the Fibonacci levels do).

**`features/chart/ChartSlot.tsx`**
- `const [emaTradesOn, setEmaTradesOn] = useLocalStorage(EMA_TRADES_KEY[side], false)` with `'chart.emaTrades'` / `'chart.emaTrades.right'` (AC 6).
- `useEmaCrossTrades(enabled, broker, symbol, timeframe, settings, lastClosedTime)` (new hook in `features/chart/useEmaCrossTrades.ts`): when enabled, `GET /setup-levels?broker&symbol&tf&emaFast&emaSlow&limit=count`; refetches when any argument changes, `lastClosedTime` being the time of the last candle in state (a WS `candle` message changes it, AC 5). Maps each setup to an `EmaCrossTrade`: `{ direction, startTime, endTime, entry, sl: number | null, riskPips: number | null, label }` where `entry = ECC ± entryPips × pipSize`, `endTime = min(closeTime ?? +∞, startTime + hours × 3600)`.
- Passes `emaCrossTrades` to `LightweightChart`; `ChartToolbar` gets `emaTradesActive` + `onToggleEmaTrades`.

**`features/chart/ChartToolbar.tsx`** · new toggle button after the drawing tools (desktop) and in the Draw row (mobile), `aria-pressed`, active style like the lock; `shared/ui/icons.tsx` gains `IconEmaTrades` (two crossing curves and a dashed vertical, as in the mockup).

**`features/chart/LightweightChart.tsx`**
- New prop `emaCrossTrades?: EmaCrossTrade[]` kept in a ref; `drawRollovers` (the overlay painter) calls `drawEmaCrossTrades(ctx, chart, series)` after the alert markers, and the prop change triggers one repaint.
- `drawEmaCrossTrades`: for each trade, x of `startTime` via `timeScale().timeToCoordinate`; x of `endTime` the same way when it falls inside the data, otherwise `logicalToCoordinate(lastIndex + (endTime − lastTime) / tfSeconds)` so a live trade projects past the last candle (AC 3); y via `series.priceToCoordinate`. Paints: the vertical dashed line (`rgba(200,168,64,0.35)` for the tag colour, full pane height), the entry line (solid `--gold`, 1.5 px), the SL line (dashed `--red`) and the fill between them (`rgba(224,92,92,0.07)`) when `sl` is not null (AC 4), the top tag `#n BUY · 02 Nov 13:00` in 9 px DM Mono gold at the vertical line, and the end labels (`BUY 1.11974` on gold, `SL 9.8 p` on red, black / white text) right after the line end, clipped to the pane like the rollover lines. Colours from the design system tokens by literal hex, as the rest of the canvas code does.
- Redraw triggers already exist: visible range change, resize, `candles` change, `updateLive` → `drawRolloversRef`.

## Data flow

```
Settings > Display ──PUT /settings { display.emaTrades }──▶ settings_display ──GET /settings──▶ ChartPage ──▶ ChartSlot
ChartSlot (overlay on) ──GET /setup-levels?…&emaFast&emaSlow&limit──▶ detectEmaCrossSetups ──setups──▶ useEmaCrossTrades ──EmaCrossTrade[]──▶ LightweightChart overlay canvas
WS candle (closed) ──▶ ChartSlot.candles ──▶ lastClosedTime changes ──▶ refetch
```

## Risks

- **Candle budget**: `/setup-levels` reads 1000 candles; on D1 with slow EMA 48 that is years of data and fine, on M5 it is 3.5 days and may hold fewer than N crosses. Acceptable (AC 8); `limit` is capped at 10.
- **Projection past the data**: `logicalToCoordinate` beyond the last bar depends on the chart's right offset; the label may fall outside the pane and is clipped. Acceptable; the lines themselves stay visible while scrolling.
- **Label overlap**: trades that end at the same x stack their labels; the end label is offset 4 px right of the line end and 16 px tall, so two trades ending together overlap only if their levels are within 16 px. Accepted for a diagnostic overlay.
- **Settings refresh**: the chart reads `/settings` on mount; changing the group while a chart tab is open needs a reload of the Chart page. Same behaviour as the Fibonacci levels.

## Mockup

Approved by the user on 2026-11-07 (iterated on a real EURUSD H1 screenshot): https://claude.ai/artifact/QixNCKFN4XJa9NYd33aULG

Artboards:
- Desktop · EURUSD H1 real chart · last 3 EMA-cross trades — vertical dashed line at each cross, gold solid entry line, red dashed SL line, faint fill between them, `#n SELL · date` tag at the top, `SELL 1.11810` / `SL 7.6 p` end labels; trade 1 ends at the next opposite cross, trades 2 and 3 at 24 h; toolbar strip with the new button active; legend. Agreed on the canvas: no marker dot, SL label with pips only, no "closed by" text, entry gold and SL red regardless of direction, EMAs 24 / 48.
- Desktop · Settings > Display · EMA cross trades group — fast EMA 24, slow EMA 48, entry offset 5 pips, projection 24 h, trades shown 3.
