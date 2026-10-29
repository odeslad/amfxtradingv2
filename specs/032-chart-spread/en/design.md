# 032 — Spread on the chart · Design

## Approach

Follow the `rectLabels` setting of spec 025 end to end: a boolean column in `settings_display`, read and written by `/settings`, a toggle in Settings › Display, and ChartPage reading it once on load. The tick data path does not change: the EA already sends `ask`, and `broadcastTicks` forwards the batch as it is (`backend/src/ws/ws.ts:90`). Only the chart starts using `ask`.

## Data flow

```
EA tick {bid, ask, m5_open…}  ──pipe──▶  backend broadcastTicks (unchanged)  ──WS ticks──▶  ChartPage
                                                                                              │ last tick of the symbol
settings_display.showSpread ──GET /settings──▶ ChartPage ──prop showSpread──▶ LightweightChart
                                                              updateLive(candle, ask)  ──▶  ASK / BID price lines
```

No EA ↔ backend contract change.

## Per layer

### db
- Migration `20261029000000_show_spread`: `ALTER TABLE "settings_display" ADD COLUMN "showSpread" BOOLEAN NOT NULL DEFAULT false;`
- `schema.prisma`: `showSpread Boolean @default(false)` in `SettingsDisplay`.

### backend (`src/routes/settings.ts`)
- `DisplayInput.showSpread?: boolean`, validated with `optionalBoolean` like `rectLabels`.
- `DisplayRow.showSpread`; GET returns `display.showSpread ?? false`; PUT writes it only when present.
- Route test: GET default `false`, PUT `true` round-trips, non-boolean → 400.

### frontend
- **Settings › Display** (`DisplayTab.tsx`, `SettingsPage.tsx`): new inline toggle row "Spread (ASK and BID lines)" under "Rectangle labels", same `toggle` markup; `DEFAULT_DISPLAY.showSpread = false`.
- **ChartPage**: read `display.showSpread` in the existing `/settings` effect; pass `showSpread` to `LightweightChart`; in the ticks handler pass `last.ask` to `updateLive`.
- **LightweightChart**:
  - `ChartHandle.updateLive(candle, ask?)`.
  - `showSpread` off → candle series keeps `priceLineVisible` / `lastValueVisible` (today).
  - `showSpread` on → candle series `priceLineVisible: false, lastValueVisible: false`, plus two `IPriceLine`s created once and moved with `applyOptions({ price })` on every tick:
    - **BID** at the live close (bid), `rgba(180,180,180,0.6)`, label `BID`.
    - **ASK** at `ask`, same grey as BID but dashed (user change during task 4; the mockup shows it red), label `ASK`; not created until a tick with `ask` arrives (AC 5).
  - Toggling the prop removes / recreates the two lines and restores the series options.
- No dependencies added.

## Alternatives

- **Setting in `localStorage` only** (frontend only): faster, but the option would not follow the user across desktop and mobile, unlike every other display setting. Rejected.
- **Second line series for the ask**: draws a history of the ask, which nobody asked for, and joins the autoscale. Rejected for price lines.

## Risks

- The pipe sends ticks every 100 ms; moving two price lines per tick is the same cost as today's `series.update`.
- Symbols where a broker sends `ask = 0` or no `ask`: treated as "no ask" (AC 5).

## Mockup

Approved 2026-10-29: https://claude.ai/artifact/EKsLdxeevvjPyZB49ZduUF

Artboards: desktop chart spread off (today) · desktop chart spread on · desktop Settings › Display · mobile chart spread on · mobile Settings › Display.
