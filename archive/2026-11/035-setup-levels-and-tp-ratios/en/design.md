# 035 — Setup levels in mirror mode, level visibility and TP ratio shortcuts · Design

## Approach

Three independent changes, each following a pattern the codebase already has:

1. **Levels in mirror mode**: drop the `mode === 'manual'` gate in `NewTradePanel` and derive a `levelsBroker` that is the manual broker or, in mirror, the preset's broker to use. Everything downstream (fetch, bid subscription, panel) keys on `levelsBroker` instead of `broker`.
2. **Level visibility**: one more column in `settings_display`, like `showSpread` (spec 032): `setupLevels TEXT[]` with the level keys to show. Settings › Display gets a toggle per level; New Trade filters `LEVEL_KEYS` by it.
3. **TP ratios**: a pure helper `tpForRatio(entry, sl, side, ratio, precision)` in `features/journal/utils/position.ts`, used by New Trade (one entry) and Edit group (one entry per position).

No EA change. No EA ↔ backend contract change. No new dependencies.

## Data flow

```
settings_display.setupLevels ──GET /settings──▶ NewTradePanel (visible levels)    SettingsPage › DisplayTab ──PUT /settings──▶ settings_display
EA ticks {bid, ask} ──pipe──▶ broadcastTicks ──WS ticks──▶ NewTradePanel (bid + ask of levelsBroker/symbol)
GET /setup-levels?broker=<levelsBroker>&symbol&tf ──▶ NewTradePanel.setup (unchanged route)
```

## Per layer

### db
- Migration `20261101000000_setup_levels`: `ALTER TABLE "settings_display" ADD COLUMN "setupLevels" TEXT[] NOT NULL DEFAULT ARRAY['ECC','EMA','EVL','MHL']::TEXT[];`
- `schema.prisma`: `setupLevels String[] @default(["ECC", "EMA", "EVL", "MHL"])` in `SettingsDisplay`.

### backend (`src/routes/settings.ts`)
- `SETUP_LEVEL_KEYS = ['ECC','EMA','EVL','MHL']`. `DisplayInput.setupLevels?: string[]`: optional array whose items must each be one of the keys (400 otherwise); duplicates removed, order normalised to `SETUP_LEVEL_KEYS`. An empty array is valid (AC 6).
- `DisplayRow.setupLevels`; GET returns `display.setupLevels ?? SETUP_LEVEL_KEYS`; PUT writes it only when present; `create` defaults to the four keys.
- Route test: GET default has the four keys, PUT `['ECC','EVL']` round-trips, `['XXX']` → 400, `[]` accepted.

### frontend

**`features/journal/utils/position.ts`**
- `export const SETUP_LEVEL_KEYS = ['ECC','EMA','EVL','MHL'] as const; export type SetupLevelKey = …`.
- `export const TP_RATIOS = [2, 3] as const`.
- `export function tpForRatio(entry: number, sl: number, buySide: boolean, ratio: number, precision: number): number | null` — `null` when `entry`/`sl` are not finite or equal; otherwise `entry ± |entry − sl| × ratio` rounded to `precision` decimals.
- `export function pricePrecision(symbol: string): number` — `3` for JPY pairs, `5` otherwise (same rule `LightweightChart.getPricePrecision` applies today; the chart keeps its own copy or imports this one).
- Unit tests (vitest, `position.test.ts`): buy/sell, both ratios, JPY precision, null cases.

**`NewTradePanel.tsx`**
- `levelsBroker = mode === 'manual' ? broker : (activeMirrorBrokers.some(m => m.broker === initialBroker) ? initialBroker : activeMirrorBrokers[0]?.broker ?? '')`.
- `levelsKey`, the `/setup-levels` effect, the ticks subscription and the panel/timeframe conditions use `levelsBroker && symbol` (no `mode` check). The levels header shows `· <levelsBroker>` in mirror mode only (mockup).
- Ticks subscription also keeps `ask` (`findLast` of the symbol; `t.ask`), so the market entry for buys is the ask.
- Visible levels: `visibleLevels = SETUP_LEVEL_KEYS.filter(k => display.setupLevels.includes(k))`, from `/settings` which the panel already fetches on open (`settings.display.setupLevels`). `visibleLevels.length === 0` hides the timeframe select and the panel.
- TP field with two modes, state `tpRatio: 2 | 3 | null`. Ratio buttons: two small outlined buttons `2:1` / `3:1` in the TP label row, right-aligned (20 px high on desktop, 24 px on mobile), the active one in orange outline (mockup). Click → `setTpRatio(r); setTp('')`.
  - `tpRatio === null` → today's price input.
  - `tpRatio` set → the input is replaced by a chip box: `<ratio> · <price>` (or `<ratio>` alone when it cannot be computed) and a ✕ that sets `tpRatio` back to `null`. The price is derived on every render: `tpForRatio(entry, parseFloat(sl), buySide, tpRatio, precision)` with `entry = isPending ? parseFloat(price) : (buySide ? ask : bid)`, so it follows SL, Price, side and ticks (AC 10). No hint text.
  - Submit: `tp = tpRatio ? computed ?? null : parseFloat(tp) || 0`; with `tpRatio` set and no computable price the submit button is disabled (AC 9).
- CSS: `.tpLabelRow`, `.ratioBtn`, `.ratioBtnActive`, `.ratioChip`; mobile media query for the 24 px height.

**`BulkEditPanel.tsx`**
- State `ratio: 2 | 3 | null`, the same two modes as New Trade. Choosing a ratio sets `ratio` and clears `tp`; the chip's ✕ sets `ratio` to `null` and shows the empty price input again (AC 13).
- Per position: `effectiveSl = sl ? parseFloat(sl) : p.sl`; `tpFor(p) = ratio && effectiveSl ? tpForRatio(p.openPrice, effectiveSl, isBuySide(p.type), ratio, pricePrecision(p.symbol)) ?? p.tp : (tp ? parseFloat(tp) : p.tp)`.
- The TP field renders as today when `ratio === null`; with a ratio it renders the chip box with ✕: `2:1 · <price>` when every `tpFor(p)` is equal, `2:1` alone otherwise (AC 12). A preview list under the row shows `#ticket · open <price> → TP <value>` or `TP kept` for positions without an effective SL (mockup).
- Submit enabled when `sl || tp || ratio`; `modifyCommand(p, effectiveSl, tpFor(p))` per position.
- CSS: same `.tpLabelRow` / `.ratioBtn` / `.ratioChip` set, plus `.ratioPreview` (bordered list, one row per position, 10 px vertical padding on desktop, 44 px rows on mobile).

**`features/settings/DisplayTab.tsx` · `SettingsPage.tsx`**
- `DisplaySettingsForm.setupLevels: SetupLevelKey[]`; `DEFAULT_DISPLAY.setupLevels = [...SETUP_LEVEL_KEYS]`.
- New "Setup levels" group at the end of the list: hint `Levels listed in the New Trade panel. All off hides the panel.`, then a 4-column grid of cards (`key`, one-line meaning, toggle) on desktop, stacked rows on mobile (mockup). Toggle → `onChange({ setupLevels: toggled list in canonical order })`.
- Meanings shown: ECC `Cross candle close` · EMA `EMA cross price` · EVL `Fast EMA extreme` · MHL `Window high / low`.
- CSS: `.levelGrid`, `.levelCard`, `.levelKey`, `.levelMeaning`; mobile stacks.

## Alternatives

- **Levels per mirror broker (one panel per broker)**: exact, but the brokers' candles differ by fractions of a pip and the panel would triple in height. Rejected; the header names the broker used.
- **Ratios in `localStorage`/custom ratio input**: out of scope by the requirements.
- **Ratio in Edit group only when one position**: simpler, but the group edit is exactly where the operator has several positions open on the same setup. Kept per position with the preview list so the result is visible before sending.

## Risks

- A mirror preset whose first enabled broker has no candles for the symbol returns `setup: null` → "No current setup", same as manual today.
- `ask` is missing on some ticks (`0`): buy market entry falls back to `null` → buttons disabled until a tick with `ask` arrives; the hint says why.
- Rounding: `toFixed(precision)` on the computed TP, the same precision the inputs use (`step="0.00001"`); JPY pairs get 3 decimals.

## Mockup

Approved 2026-11-01: https://claude.ai/artifact/UR82sSuiLJdZkYR8jsEJuH

Artboards: Desktop · New Trade · Mirror with levels · Desktop · New Trade · Manual (EMA hidden, ratio disabled) · Desktop · Edit group · ratio chip · Desktop · Settings › Display · Mobile · New Trade · Mirror with levels · Mobile · Edit group · Mobile · Settings › Display.
